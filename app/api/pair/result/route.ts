/**
 * 查看配对结果（核心）
 * GET /api/pair/result?pairSessionId=...
 *
 * 前端 result 页调用，根据当前用户视角返回相应结果。
 *
 * 状态机（unlocked = B 已分享，基础结果可见；paid = 已付费，深度内容可见）：
 * - isInitiator=true（A 视角）：
 *   - unlocked = resultSharedToInitiator
 *   - paid = PairSession.unlocked
 * - isInitiator=false（B 视角）：
 *   - unlocked = resultSharedToInitiator（B 未分享时引导 B 分享）
 *   - paid = PairSession.unlocked
 *
 * 返回策略：
 * - resultSharedToInitiator=false：返回最小信息 { pairSessionId, isInitiator, unlocked: false, paid: false }
 * - resultSharedToInitiator=true：返回基础信息（默契度 + 类型 emoji/name/oneLiner），深度内容根据 paid 决定
 *
 * 类型匹配：
 * - PairSession.matchedTypeId 非空：关联 CoupleType 表
 * - 为空（Phase 1 未实现匹配）：按 genderCombo 取该组合的第一个 common 类型作为占位，
 *   并在 summary 中标注「类型匹配待 Phase 3 完善」
 *
 * 权限：当前用户必须是 initiatorUserId 或 responderUserId
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { buildResultData } from '@/lib/pair-result';
import type { ApiResponse } from '@/shared/types';

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

    const pairSessionId = request.nextUrl.searchParams.get('pairSessionId');
    if (!pairSessionId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 pairSessionId 参数' },
        { status: 400 },
      );
    }

    // 查 PairSession（含 CoupleType 关联）
    const pair = await prisma.pairSession.findUnique({
      where: { id: pairSessionId },
      include: {
        coupleType: true,
        initiatorUser: { select: { nickname: true, avatarUrl: true } },
        responderUser: { select: { nickname: true, avatarUrl: true } },
      },
    });

    if (!pair) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '配对记录不存在' },
        { status: 404 },
      );
    }

    // 权限：必须是 A 或 B
    const isInitiator = pair.initiatorUserId === userId;
    const isResponder = pair.responderUserId === userId;
    if (!isInitiator && !isResponder) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    const data = await buildResultData(pair, userId);

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
