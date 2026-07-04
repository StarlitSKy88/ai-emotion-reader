/**
 * 提交任务回应（Phase 4.3.3）
 * POST /api/task/[taskId]/response
 *
 * body: { content: string, mediaUrls?: string[], status?: 'done' | 'skipped' }
 *
 * 流程：
 * 1. 认证 → 找 couple → 校验任务属于 couple
 * 2. 防重复：用户已提交过回应则返回 400
 * 3. 调 LLM 命名情绪（buildEmotionNamingPrompt + chatCompletion）
 * 4. 创建 TaskResponse（含 emotionTag/perspective）
 * 5. 更新 DailyTask.statusA 或 statusB
 * 6. 返回更新后的 DailyTaskInfo（含双方回应详情）
 *
 * aiSummary 生成留给 /api/task/[taskId]/summary 路由按需触发
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { chatCompletion } from '@/lib/llm';
import { buildEmotionNamingPrompt, buildFallbackEmotionNaming } from '@/lib/prompts';
import {
  detectCrisis,
  CRISIS_BOUNDARY_PROMPT,
  HIGH_RISK_RESPONSE,
} from '@/lib/crisis-detector';
import {
  buildDailyTaskInfo,
  getCoupleForUser,
  getUserRoleInCouple,
  parseJsonFromLlm,
} from '@/lib/task-service';
import type { ApiResponse, EmotionNamingResult, TaskStatus } from '@/shared/types';

/** 情绪命名系统提示词 */
const EMOTION_NAMING_SYSTEM_PROMPT =
  '你是「问心 AI」的情绪命名师。严格按用户要求的 JSON 格式输出，不要任何额外文字、不要 markdown 代码块。';

interface ResponseBody {
  content: string;
  mediaUrls?: string[];
  status?: 'done' | 'skipped';
}

export async function POST(
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

    // 解析 body
    const body = (await request.json()) as ResponseBody;
    const content = (body.content || '').trim();
    const mediaUrls = Array.isArray(body.mediaUrls)
      ? body.mediaUrls.slice(0, 3) // 最多 3 张
      : [];
    const status: TaskStatus = body.status === 'skipped' ? 'skipped' : 'done';

    // done 状态必须有内容
    if (status === 'done' && !content) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '完成打卡需要写下感受' },
        { status: 400 },
      );
    }

    // 查任务
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

    const role = getUserRoleInCouple(couple, userId);
    if (!role) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 防重复：用户已提交过回应
    const existingResponse = task.responses.find((r) => r.userId === userId);
    if (existingResponse) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '今日已提交过回应' },
        { status: 400 },
      );
    }

    // 调 LLM 命名情绪（content 为空时跳过，如 skipped 状态）
    // 5.4 危机检测：high 级别不调 LLM，直接用 HIGH_RISK_RESPONSE；
    // middle 级别调 LLM 但叠加 CRISIS_BOUNDARY_PROMPT
    let emotionTag: string | null = null;
    let perspective: string | null = null;
    let crisisLevel: 'low' | 'middle' | 'high' = 'low';
    if (content) {
      const crisis = detectCrisis(content);
      crisisLevel = crisis.level;

      if (crisis.level === 'high') {
        // 高风险：不调 LLM，emotionTag 标记危机，perspective 用固定话术
        emotionTag = '危机';
        perspective = HIGH_RISK_RESPONSE.slice(0, 500);
      } else {
        try {
          // middle 级别叠加危机边界 Prompt
          const prompt =
            crisis.level === 'middle'
              ? `${buildEmotionNamingPrompt(task.title, content)}\n\n${CRISIS_BOUNDARY_PROMPT}`
              : buildEmotionNamingPrompt(task.title, content);
          const raw = await chatCompletion(
            EMOTION_NAMING_SYSTEM_PROMPT,
            prompt,
            256,
          );
          const parsed = parseJsonFromLlm<EmotionNamingResult>(raw);
          if (parsed && parsed.emotionTag) {
            emotionTag = parsed.emotionTag.slice(0, 20);
            perspective = (parsed.perspective || '').slice(0, 100);
          }
        } catch {
          // W-PQ-1 修复：LLM 失败不阻塞提交，用兜底文案让用户仍能感受到「被看见」
          const fallback = buildFallbackEmotionNaming(content);
          emotionTag = fallback.emotionTag;
          perspective = fallback.perspective;
        }
      }
    }

    // 事务：创建 TaskResponse + 更新 DailyTask 状态
    // W-1 修复：DB 层 @@unique([taskId, userId]) 防并发重复提交
    try {
      const [newResponse, updatedTask] = await prisma.$transaction([
        prisma.taskResponse.create({
          data: {
            taskId,
            userId,
            content,
            emotionTag,
            perspective,
            mediaUrls,
          },
        }),
        prisma.dailyTask.update({
          where: { id: taskId },
          data:
            role === 'A'
              ? { statusA: status }
              : { statusB: status },
          include: { responses: true },
        }),
      ]);

      // 静默引用 newResponse 避免未使用警告（实际已写入 DB）
      void newResponse;

      const data = buildDailyTaskInfo(updatedTask, userId, couple, true);
      // crisisLevel 透传给前端，high 级别前端自动跳转资源页
      return NextResponse.json<ApiResponse<typeof data & { crisisLevel: 'low' | 'middle' | 'high' }>>({
        success: true,
        data: { ...data, crisisLevel },
      });
    } catch (err) {
      // Prisma 唯一约束冲突：P2002
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        err.code === 'P2002'
      ) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '今日已提交过回应' },
          { status: 400 },
        );
      }
      throw err;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '提交失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
