/**
 * 任务默契度总结（Phase 4.3.4）
 * GET /api/task/[taskId]/summary
 *
 * 双方都完成后返回默契度总结。
 * - 首次调用时调 LLM 生成（buildTaskSummaryPrompt + chatCompletion），写入 DailyTask.aiSummary
 * - 后续调用直接返回已生成的 aiSummary
 *
 * 触发条件：双方 status 都是 done/skipped 且双方都有 response
 *
 * 返回 TaskSummaryResult { compatibility, summary, resonancePoints, complementaryPoints }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { chatCompletion } from '@/lib/llm';
import { buildTaskSummaryPrompt } from '@/lib/prompts';
import {
  getCoupleForUser,
  parseJsonFromLlm,
} from '@/lib/task-service';
import { pushToBoth } from '@/lib/push-service';
import type { ApiResponse, TaskSummaryResult, TaskResponseInfo } from '@/shared/types';

/** 任务总结系统提示词 */
const TASK_SUMMARY_SYSTEM_PROMPT =
  '你是「问心 AI」的默契度分析师。严格按用户要求的 JSON 格式输出，不要任何额外文字、不要 markdown 代码块。';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } },
) {
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

    const { taskId } = params;
    if (!taskId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 taskId 参数' },
        { status: 400 },
      );
    }

    // 查任务（含回应）
    const task = await prisma.dailyTask.findUnique({
      where: { id: taskId },
      include: { responses: true },
    });
    if (!task) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '任务不存在' },
        { status: 404 },
      );
    }

    // 权限：必须是 couple 成员
    const couple = await getCoupleForUser(userId);
    if (!couple || couple.id !== task.coupleId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 校验双方都已完成
    const bothDone =
      (task.statusA === 'done' || task.statusA === 'skipped') &&
      (task.statusB === 'done' || task.statusB === 'skipped');
    if (!bothDone) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '双方都需完成才能生成总结' },
        { status: 400 },
      );
    }

    // 校验双方都有回应
    if (task.responses.length < 2) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '双方都需提交回应才能生成总结' },
        { status: 400 },
      );
    }

    // 已有 aiSummary → 解析返回
    if (task.aiSummary) {
      const cached = parseJsonFromLlm<TaskSummaryResult>(task.aiSummary);
      if (cached && typeof cached.compatibility === 'number') {
        return NextResponse.json<ApiResponse<TaskSummaryResult>>({
          success: true,
          data: cached,
        });
      }
    }

    // W-2 修复：用 updateMany + where: { aiSummary: null } 抢占首次生成权
    // A、B 几乎同时调 summary 时，只有一个 updateMany 能命中（count=1），
    // 另一个 count=0 → 直接读已生成的 aiSummary 返回，避免双重 LLM + 双重推送
    // 此处仅在「已确认 aiSummary 为 null」时进入，先调 LLM
    // （LLM 成本低，宁可一方多调一次，后续 updateMany 保证只有一方写入 + 推送）

    // 找到 A 和 B 的回应（按 couple 角色映射）
    const responseA = couple.partnerAId
      ? task.responses.find((r) => r.userId === couple.partnerAId)
      : undefined;
    const responseB = couple.partnerBId
      ? task.responses.find((r) => r.userId === couple.partnerBId)
      : undefined;

    if (!responseA || !responseB) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '找不到双方完整回应' },
        { status: 400 },
      );
    }

    // V2 优化（W-9）：原逻辑在初始 check 后直接调 LLM，并发场景下两个请求都过初始 check 后
    // 仍会各自调 LLM（updateMany 抢占只保证写入不重复，不保证 LLM 调用不浪费）。
    // 改为：调 LLM 前再 re-fetch 一次 aiSummary，若已被并发写入则直接返回，避免浪费 LLM 调用。
    // 说明：仍存在极小竞态窗口（re-check 后、LLM 调用前另一请求写入），但能消除大部分浪费。
    const recheck = await prisma.dailyTask.findUnique({
      where: { id: taskId },
      select: { aiSummary: true },
    });
    if (recheck?.aiSummary) {
      const cached = parseJsonFromLlm<TaskSummaryResult>(recheck.aiSummary);
      if (cached && typeof cached.compatibility === 'number') {
        return NextResponse.json<ApiResponse<TaskSummaryResult>>({
          success: true,
          data: cached,
        });
      }
    }

    // 调 LLM 生成总结
    let result: TaskSummaryResult;
    try {
      const prompt = buildTaskSummaryPrompt(
        task.title,
        responseA as unknown as TaskResponseInfo,
        responseB as unknown as TaskResponseInfo,
      );
      const raw = await chatCompletion(
        TASK_SUMMARY_SYSTEM_PROMPT,
        prompt,
        512,
      );
      const parsed = parseJsonFromLlm<TaskSummaryResult>(raw);

      if (parsed && typeof parsed.compatibility === 'number') {
        result = {
          compatibility: Math.max(0, Math.min(100, Math.round(parsed.compatibility))),
          summary: (parsed.summary || '').slice(0, 500),
          resonancePoints: Array.isArray(parsed.resonancePoints)
            ? parsed.resonancePoints.slice(0, 3).map((s) => String(s).slice(0, 100))
            : [],
          complementaryPoints: Array.isArray(parsed.complementaryPoints)
            ? parsed.complementaryPoints.slice(0, 3).map((s) => String(s).slice(0, 100))
            : [],
        };
      } else {
        // LLM 返回格式不对，用兜底
        result = buildFallbackSummary(responseA, responseB);
      }
    } catch {
      // LLM 调用失败，用兜底
      result = buildFallbackSummary(responseA, responseB);
    }

    // W-2 修复：用 updateMany + where: { id, aiSummary: null } 抢占首次写入权
    // count > 0 表示本次成功写入（首次推送）；count = 0 表示已被并发请求写入（不推送）
    const updateResult = await prisma.dailyTask.updateMany({
      where: { id: taskId, aiSummary: null },
      data: { aiSummary: JSON.stringify(result) },
    });
    const isFirstWriter = updateResult.count > 0;

    if (!isFirstWriter) {
      // 并发场景：另一个请求先写入，读其结果返回
      const refreshed = await prisma.dailyTask.findUnique({
        where: { id: taskId },
        select: { aiSummary: true },
      });
      if (refreshed?.aiSummary) {
        const cached = parseJsonFromLlm<TaskSummaryResult>(refreshed.aiSummary);
        if (cached && typeof cached.compatibility === 'number') {
          return NextResponse.json<ApiResponse<TaskSummaryResult>>({
            success: true,
            data: cached,
          });
        }
      }
    }

    // 4.5：仅首次写入方触发 task_summary 推送（避免双重推送）
    if (isFirstWriter && couple.partnerAId && couple.partnerBId) {
      // 不 await：fire-and-forget，避免阻塞 LLM 总结返回
      void pushTaskSummaryToBoth(
        couple.partnerAId,
        couple.partnerBId,
        task.id,
        task.title,
        result,
      ).catch(() => {
        // 兜底：pushToBoth 内部已 catch，这里再 catch 防止 unhandled rejection
      });
    }

    return NextResponse.json<ApiResponse<TaskSummaryResult>>({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成总结失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/**
 * 兜底总结（LLM 失败时用）
 * V2 优化（S-2）：原固定 compatibility=60，改为根据双方 emotionTag 简单计算
 * - 同 emotionTag（共鸣信号）+15
 * - 都有 emotionTag 但不同（互补）+5
 * - 只有一方有 emotionTag 0
 * - 都没有 emotionTag 0
 * base 60，最终 clamp 到 [0, 100]
 */
function buildFallbackSummary(
  responseA: { emotionTag?: string | null } | undefined,
  responseB: { emotionTag?: string | null } | undefined,
): TaskSummaryResult {
  const tagA = responseA?.emotionTag?.trim() || '';
  const tagB = responseB?.emotionTag?.trim() || '';

  let compatibility = 60;
  let resonancePoints: string[] = ['双方都愿意为关系投入时间'];
  let complementaryPoints: string[] = ['各自的视角丰富了这段关系'];

  if (tagA && tagB) {
    if (tagA === tagB) {
      // 同情绪 = 强共鸣信号
      compatibility += 15;
      resonancePoints = [`双方都感受到「${tagA}」`];
      complementaryPoints = ['表达方式各有侧重'];
    } else {
      // 不同情绪 = 互补信号
      compatibility += 5;
      resonancePoints = ['都愿意坦诚表达情绪'];
      complementaryPoints = [`「${tagA}」与「${tagB}」形成互补`];
    }
  }

  compatibility = Math.max(0, Math.min(100, compatibility));

  return {
    compatibility,
    summary:
      '你们都完成了今天的任务，这本身就是一种默契。每一份回应都是对关系的投入，看见彼此的努力，就是成长的开始。',
    resonancePoints,
    complementaryPoints,
  };
}

/**
 * 推送 task_summary 给双方
 * - thing1：今日任务标题（前 20 字）
 * - number2：默契度（0-100）
 * - thing3：一句话总结（前 20 字）
 */
async function pushTaskSummaryToBoth(
  userIdA: string,
  userIdB: string,
  taskId: string,
  taskTitle: string,
  summary: TaskSummaryResult,
): Promise<void> {
  await pushToBoth(
    userIdA,
    userIdB,
    'task_summary',
    {
      thing1: { value: taskTitle.slice(0, 20) },
      number2: { value: String(summary.compatibility) },
      thing3: { value: summary.summary.slice(0, 20) },
    },
    `pages/task/detail?taskId=${taskId}`,
  );
}
