/**
 * 订阅消息定时推送（Phase 4.5.3）
 * GET /api/push/cron
 *
 * 由外部调度（Vercel Cron / EdgeOne / 阿里云定时 / crontab）每 5 分钟调用一次，
 * 触发两类推送：
 * - daily_task：每日 9:00（env TIMEZONE，默认 Asia/Shanghai）推送今日任务提醒
 * - task_summary：双方完成任务的当下立即推送（在 task/[taskId]/summary 路由内直接调用）
 *
 * 鉴权：通过 CRON_SECRET 环境变量校验 Bearer token，
 *   避免公网任意请求触发推送浪费配额。
 *
 * 实现要点：
 * 1. 查询所有 count > 0 的 PushSubscription（按 scene=daily_task 过滤）
 * 2. 对每个用户：
 *    a. 找到 active Couple
 *    b. 用 getTodayDateInTimezone 查今日 DailyTask
 *    c. 校验当前北京时间小时数 === 9（仅在指定时段推送，避免凌晨打扰）
 *    d. 双方都未完成才推送（已完成不打扰）
 *    e. 调 sendSubscribeMessage 下发，成功后 count -= 1
 * 3. 错误隔离：单用户失败不影响其他用户
 *
 * 性能：单次最多处理 100 个用户（避免单次执行时间过长），剩余下次执行。
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  sendSubscribeMessage,
  getTemplateIdByScene,
} from '@/lib/wechat-mp';
import { getTodayDateInTimezone, getDefaultTimezone } from '@/lib/task-service';

/** 单次最多处理用户数 */
const BATCH_SIZE = 100;
/** 北京时间 9:00 推送（小时数 1-23） */
const PUSH_HOUR_BJS = 9;

/**
 * 常数时间字符串比较（防止时序攻击泄露 token）
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

interface PushJob {
  userId: string;
  openid: string;
  templateId: string;
  taskTitle: string;
  taskDesc: string;
  taskDate: string;
  page: string;
}

export async function GET(request: NextRequest) {
  try {
    // 1. CRON_SECRET 鉴权
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET 未配置' },
        { status: 500 },
      );
    }
    const authHeader = request.headers.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    // W-S-5 修复：用 timingSafeEqual 常数时间比较，防时序攻击
    if (!match || !safeEqual(match[1], cronSecret)) {
      return NextResponse.json(
        { success: false, error: '鉴权失败' },
        { status: 401 },
      );
    }

    // 2. 仅在默认时区 9:00 ± 30 分钟（即小时数 === 9）触发 daily_task 推送
    // V2 优化（W-8）：原硬编码 'Asia/Shanghai'，改为从 env TIMEZONE 读取
    const now = new Date();
    const tz = getDefaultTimezone();
    const bjsHour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
      }).format(now),
    );
    if (bjsHour !== PUSH_HOUR_BJS) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `当前 ${tz} ${bjsHour}:xx，非推送时段（${PUSH_HOUR_BJS}:00）`,
      });
    }

    const templateId = getTemplateIdByScene('daily_task');
    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'WECHAT_TMPL_DAILY_TASK 未配置' },
        { status: 500 },
      );
    }

    // 3. 查所有 count > 0 的 daily_task 订阅记录
    const subs = await prisma.pushSubscription.findMany({
      where: { scene: 'daily_task', count: { gt: 0 } },
      take: BATCH_SIZE,
      select: { id: true, userId: true, count: true },
    });

    // 4. 查用户 openid
    const userIds = subs.map((s) => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, openid: true },
    });
    const userOpenidMap = new Map(users.map((u) => [u.id, u.openid]));

    // 5. 构建推送任务列表
    // V2 优化（W-8）：原硬编码 'Asia/Shanghai'，改为从 env TIMEZONE 读取
    const { dateStr: todayStr } = getTodayDateInTimezone(tz);
    const todayDateObj = new Date(todayStr + 'T00:00:00Z');

    // B-P-1 修复：批量查询替代 N+1，200 次 DB 往返降为 2 次
    // 复用上文 step 4 已声明的 userIds
    const couples = await prisma.couple.findMany({
      where: {
        OR: [{ partnerAId: { in: userIds } }, { partnerBId: { in: userIds } }],
        status: 'active',
      },
      select: { id: true, partnerAId: true, partnerBId: true },
    });
    const coupleMap = new Map<
      string,
      { couple: (typeof couples)[0]; role: 'A' | 'B' }
    >();
    for (const c of couples) {
      if (c.partnerAId && userIds.includes(c.partnerAId)) {
        coupleMap.set(c.partnerAId, { couple: c, role: 'A' });
      }
      if (c.partnerBId && userIds.includes(c.partnerBId)) {
        coupleMap.set(c.partnerBId, { couple: c, role: 'B' });
      }
    }

    const coupleIds = couples.map((c) => c.id);
    const todayTasks = await prisma.dailyTask.findMany({
      where: { coupleId: { in: coupleIds }, date: todayDateObj },
      select: {
        id: true,
        title: true,
        description: true,
        statusA: true,
        statusB: true,
        coupleId: true,
      },
    });
    const taskMap = new Map<string, (typeof todayTasks)[0]>();
    for (const t of todayTasks) {
      taskMap.set(t.coupleId, t);
    }

    const jobs: PushJob[] = [];
    for (const sub of subs) {
      const openid = userOpenidMap.get(sub.userId);
      if (!openid) continue;

      // 从 coupleMap 取 active Couple
      const entry = coupleMap.get(sub.userId);
      if (!entry) continue;
      const { couple, role } = entry;

      // 从 taskMap 取今日任务
      const task = taskMap.get(couple.id);
      if (!task) continue;

      // W-3 修复：按 sub.userId 映射到本人在 couple 中的角色，
      // 仅当「本人未完成」时推送（已完成者不打扰）
      const userStatus = role === 'A' ? task.statusA : task.statusB;
      const userDone = userStatus === 'done' || userStatus === 'skipped';
      if (userDone) continue;

      jobs.push({
        userId: sub.userId,
        openid,
        templateId,
        taskTitle: task.title.slice(0, 20),
        taskDesc: task.description.slice(0, 20),
        taskDate: todayStr,
        page: `pages/task/detail?taskId=${task.id}`,
      });
    }

    // 6. 并发批处理下发（W-6：避免串行 100 条超 serverless 超时）
    // 每批 10 个并发，错误隔离
    const results = {
      total: jobs.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ userId: string; errcode?: number; errmsg?: string }>,
    };

    const CHUNK_SIZE = 10;
    for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
      const chunk = jobs.slice(i, i + CHUNK_SIZE);
      const settled = await Promise.allSettled(
        chunk.map((job) => sendOne(job)),
      );
      settled.forEach((s, idx) => {
        const job = chunk[idx];
        if (s.status === 'fulfilled') {
          if (s.value.success) {
            results.success += 1;
          } else {
            results.failed += 1;
            results.errors.push({
              userId: job.userId,
              errcode: s.value.errcode,
              errmsg: s.value.errmsg,
            });
          }
        } else {
          results.failed += 1;
          results.errors.push({
            userId: job.userId,
            errmsg: s.reason instanceof Error ? s.reason.message : 'unknown',
          });
        }
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'cron 执行失败';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/**
 * 单个推送任务执行（含 count 扣减 + 43101 处理）
 * 返回值与 sendSubscribeMessage 一致
 */
async function sendOne(job: PushJob): Promise<{
  success: boolean;
  errcode?: number;
  errmsg?: string;
}> {
  const sendResult = await sendSubscribeMessage(
    job.openid,
    job.templateId,
    {
      thing1: { value: job.taskTitle },
      thing2: { value: job.taskDesc },
      date3: { value: job.taskDate },
    },
    job.page,
  );
  if (sendResult.success) {
    // 推送成功，count -= 1（updateMany + count > 0 防并发超额扣减）
    await prisma.pushSubscription.updateMany({
      where: {
        userId: job.userId,
        templateId: job.templateId,
        scene: 'daily_task',
        count: { gt: 0 },
      },
      data: { count: { decrement: 1 } },
    });
  } else {
    // errcode 43101 = 用户未订阅/已退订，清空 count 避免重复尝试
    if (sendResult.errcode === 43101) {
      await prisma.pushSubscription.updateMany({
        where: { userId: job.userId, templateId: job.templateId, scene: 'daily_task' },
        data: { count: 0 },
      });
    }
  }
  return sendResult;
}
