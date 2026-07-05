/**
 * 获取今日任务（Phase 4.3.1）
 * GET /api/task/today
 *
 * 每天每对情侣只生成 1 个任务（@@unique([coupleId, date])）。
 * 首次访问时自动生成：
 * 1. 调 task-generator.generateTaskPlan 选维度+难度+fallback
 * 2. 调 LLM 生成具体任务（buildTaskGenerationPrompt + chatCompletion）
 * 3. LLM 失败时用 fallback 任务兜底
 *
 * V3 商业化:30 天挑战断点续接
 * - 创建今日任务时,基于昨天任务完成情况计算进度
 * - 都 done → completedDates + 1, streakAlive 保持 true
 * - 任一未 done → streakAlive = false, lastBreakDate = 昨天(如果还没设)
 * - 不重新计算 completedDates(累计值,从昨天任务继承)
 * - 进度字段(streakAlive/lastBreakDate/completedDates)存储在 DailyTask 上,
 *   每日任务携带截至当天的进度快照
 *
 * 返回 { task: DailyTaskInfo, progress: ChallengeProgress }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { chatCompletion } from '@/lib/llm';
import { generateTaskPlan } from '@/lib/task-generator';
import { buildTaskGenerationPrompt } from '@/lib/prompts';
import {
  buildDailyTaskInfo,
  getCoupleForUser,
  getDefaultTimezone,
  getTodayDateInTimezone,
  isValidDimensions,
  parseJsonFromLlm,
} from '@/lib/task-service';
import type {
  ApiResponse,
  ChallengeProgress,
  DimensionScores,
  RelationshipStage,
  TaskGenerationInput,
  TaskGenerationOutput,
} from '@/shared/types';

/** 任务生成系统提示词 */
const TASK_GEN_SYSTEM_PROMPT =
  '你是「问心 AI」的每日任务生成器。严格按用户要求的 JSON 格式输出，不要任何额外文字、不要 markdown 代码块。';

/** 30 天挑战总天数 */
const CHALLENGE_TOTAL_DAYS = 30;

/** V3 进度快照(从昨日任务继承并更新) */
interface ProgressSnapshot {
  completedDates: number;
  streakAlive: boolean;
  lastBreakDate: Date | null;
}

/**
 * 基于昨天任务完成情况计算今日进度快照
 * - 都 done → completedDates + 1, streakAlive = true
 * - 任一未 done → streakAlive = false, lastBreakDate = 昨天(如果还没设)
 * - 不重新计算 completedDates(累计值,从昨天继承)
 *
 * @param coupleId 情侣 ID
 * @param todayDateObj 今日日期(UTC 午夜)
 */
async function calculateProgressFromYesterday(
  coupleId: string,
  todayDateObj: Date,
): Promise<ProgressSnapshot> {
  const yesterday = new Date(todayDateObj);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const yesterdayTask = await prisma.dailyTask.findUnique({
    where: { coupleId_date: { coupleId, date: yesterday } },
    select: {
      statusA: true,
      statusB: true,
      completedDates: true,
      streakAlive: true,
      lastBreakDate: true,
    },
  });

  // 继承昨天的累计值
  let completedDates = yesterdayTask?.completedDates ?? 0;
  let streakAlive = yesterdayTask?.streakAlive ?? true;
  let lastBreakDate = yesterdayTask?.lastBreakDate ?? null;

  if (yesterdayTask) {
    const aDoneYesterday = yesterdayTask.statusA === 'done';
    const bDoneYesterday = yesterdayTask.statusB === 'done';
    const bothDoneYesterday = aDoneYesterday && bDoneYesterday;

    if (bothDoneYesterday) {
      // 双方都 done → completedDates + 1, streakAlive 保持 true
      completedDates += 1;
      streakAlive = true;
    } else {
      // 任一未 done → streakAlive = false, lastBreakDate = 昨天(如果还没设)
      streakAlive = false;
      if (!lastBreakDate) {
        lastBreakDate = yesterday;
      }
    }
  }
  // 昨天无任务(挑战未开始/跨天首次访问) → 继承默认值

  return { completedDates, streakAlive, lastBreakDate };
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthHeader(
      request.headers.get('Authorization'),
    );
    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未登录' },
        { status: 401 },
      );
    }

    // 1. 找 couple
    const couple = await getCoupleForUser(userId);
    if (!couple) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '尚未配对，请先完成情侣测试' },
        { status: 404 },
      );
    }

    // 2. 时区 + 今日日期
    // V2 优化（W-8）：原硬编码 'Asia/Shanghai'，改为从 env TIMEZONE 读取
    const timezone = getDefaultTimezone();
    const { dateObj } = getTodayDateInTimezone(timezone);

    // 3. 查今日任务是否存在
    const existing = await prisma.dailyTask.findUnique({
      where: { coupleId_date: { coupleId: couple.id, date: dateObj } },
      include: { responses: true },
    });

    let task = existing;
    if (!task) {
      // 4. 不存在则生成(同时计算 V3 进度快照)
      const progress = await calculateProgressFromYesterday(couple.id, dateObj);
      task = await generateAndCreateTask(couple, dateObj, timezone, progress);
    }

    if (!task) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '任务生成失败，请稍后重试' },
        { status: 500 },
      );
    }

    // 5. 从今日任务读取 V3 进度快照
    const progress: ChallengeProgress = {
      completedDates: task.completedDates,
      totalDays: CHALLENGE_TOTAL_DAYS,
      streakAlive: task.streakAlive,
      lastBreakDate: task.lastBreakDate ? task.lastBreakDate.toISOString() : null,
      todayCompleted: task.statusA === 'done' && task.statusB === 'done',
    };

    // 6. 返回 { task: DailyTaskInfo, progress }
    const taskInfo = buildDailyTaskInfo(task, userId, couple, false);
    const data = { task: taskInfo, progress };
    return NextResponse.json<ApiResponse<typeof data>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/**
 * 生成并创建今日任务
 * LLM 失败时用 fallback 任务兜底
 */
async function generateAndCreateTask(
  couple: Awaited<ReturnType<typeof getCoupleForUser>>,
  dateObj: Date,
  timezone: string,
  progress: ProgressSnapshot,
) {
  if (!couple || !couple.pairSession) return null;

  // 构造 TaskGenerationInput
  const dimsA = couple.pairSession.dimensionsA;
  const dimsB = couple.pairSession.dimensionsB;

  // 维度分数不完整 → 直接用 fallback（不调 LLM）
  if (!isValidDimensions(dimsA) || !isValidDimensions(dimsB)) {
    return createFallbackTask(couple, dateObj, timezone, progress);
  }

  // 查昨日任务完成情况（用于不对称检测）
  const yesterday = new Date(dateObj);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayTask = await prisma.dailyTask.findUnique({
    where: { coupleId_date: { coupleId: couple.id, date: yesterday } },
    select: { statusA: true, statusB: true },
  });
  const aCompletedYesterday = yesterdayTask?.statusA === 'done';
  const bCompletedYesterday = yesterdayTask?.statusB === 'done';

  // 查已生成任务数（用于 streakDays 轮转，避免 fallback 重复）
  const taskCount = await prisma.dailyTask.count({
    where: { coupleId: couple.id },
  });

  // 计算在一起月数（简化：用 couple.createdAt 估算，后续可从 profile.relationshipStart 读）
  const monthsTogether = Math.max(
    0,
    Math.floor(
      (Date.now() - couple.createdAt.getTime()) /
        (1000 * 60 * 60 * 24 * 30),
    ),
  );

  const input: TaskGenerationInput = {
    coupleTypeCode: couple.pairSession.matchedTypeId || undefined,
    dimensionsA: dimsA as DimensionScores,
    dimensionsB: dimsB as DimensionScores,
    // V2 优化（S-1）：原硬编码 'stable'，改为从 couple.profile.relationshipStage 读（如有），
    // Couple.stage 是社会状态（dating/engaged/married），与心理阶段不同，不能用 couple.stage
    // profile 是 Json 字段，需安全解析；不合法时回退 'stable'
    stage: parseRelationshipStage(couple.profile),
    monthsTogether,
    emotionTrendA: [], // Phase 4 暂不实现情绪趋势采集
    emotionTrendB: [],
    aCompletedYesterday,
    bCompletedYesterday,
    streakDays: taskCount,
  };

  // 生成 plan
  const plan = generateTaskPlan(input);

  // 尝试 LLM 生成
  try {
    const prompt = buildTaskGenerationPrompt(input, plan);
    const raw = await chatCompletion(TASK_GEN_SYSTEM_PROMPT, prompt, 512);
    const parsed = parseJsonFromLlm<TaskGenerationOutput>(raw);

    if (parsed && parsed.title && parsed.description) {
      // LLM 成功，用 LLM 结果
      return await prisma.dailyTask.create({
        data: {
          coupleId: couple.id,
          date: dateObj,
          timezone,
          title: parsed.title.slice(0, 100),
          description: parsed.description.slice(0, 1000),
          difficulty: plan.difficulty,
          sourceDimension: plan.sourceDimension,
          targetDimension: plan.targetDimension,
          estimatedMin: parsed.estimatedMin || plan.fallbackTask.estimatedMin,
          // V3 进度快照
          completedDates: progress.completedDates,
          streakAlive: progress.streakAlive,
          lastBreakDate: progress.lastBreakDate,
        },
        include: { responses: true },
      });
    }
    // LLM 返回格式不对，降级 fallback
  } catch {
    // LLM 调用失败，降级 fallback
  }

  return createFallbackTask(couple, dateObj, timezone, progress, plan.fallbackTask);
}

/**
 * 用 fallback 任务创建（维度分数不完整或 LLM 失败时）
 */
async function createFallbackTask(
  couple: NonNullable<Awaited<ReturnType<typeof getCoupleForUser>>>,
  dateObj: Date,
  timezone: string,
  progress: ProgressSnapshot,
  forcedFallback?: {
    title: string;
    description: string;
    difficulty: string;
    sourceDimension: string;
    targetDimension?: string;
    estimatedMin: number;
  },
) {
  // 如果没指定 fallback，用 D1 easy 兜底
  const fallback =
    forcedFallback ||
    {
      title: '写下你今天最强烈的一个情绪',
      description:
        '花 3 分钟，写下你今天体验到的最强烈的一个情绪，以及触发它的事件。不需要发给对方，只是先看见自己。',
      difficulty: 'easy',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 3,
    };

  try {
    return await prisma.dailyTask.create({
      data: {
        coupleId: couple.id,
        date: dateObj,
        timezone,
        title: fallback.title,
        description: fallback.description,
        difficulty: fallback.difficulty,
        sourceDimension: fallback.sourceDimension,
        targetDimension: fallback.targetDimension || null,
        estimatedMin: fallback.estimatedMin,
        // V3 进度快照
        completedDates: progress.completedDates,
        streakAlive: progress.streakAlive,
        lastBreakDate: progress.lastBreakDate,
      },
      include: { responses: true },
    });
  } catch (error) {
    // 并发场景：另一个用户已创建，重新查询
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      return prisma.dailyTask.findUnique({
        where: { coupleId_date: { coupleId: couple.id, date: dateObj } },
        include: { responses: true },
      });
    }
    throw error;
  }
}

/**
 * 从 Couple.profile（Json 字段）安全解析 relationshipStage
 * V2 优化（S-1）：原硬编码 'stable'，改为读 profile.relationshipStage
 * @returns 合法的 RelationshipStage，不合法或缺失时回退 'stable'
 */
function parseRelationshipStage(profile: unknown): RelationshipStage {
  const VALID_STAGES: RelationshipStage[] = [
    'honeymoon',
    'adjustment',
    'stable',
    'crisis',
    'rebirth',
  ];
  if (!profile || typeof profile !== 'object') return 'stable';
  const raw = (profile as Record<string, unknown>).relationshipStage;
  if (typeof raw === 'string' && (VALID_STAGES as string[]).includes(raw)) {
    return raw as RelationshipStage;
  }
  return 'stable';
}
