/**
 * 解锁深度结果
 * POST /api/pair/unlock
 *
 * B-WC-1 修复：MVP 阶段深度内容免费开放，此路由保留向后兼容，V2 接入虚拟支付后恢复。
 *
 * body: { pairSessionId, method: 'free' | 'pay' | 'ad' }
 *
 * 逻辑：
 * 1. 需登录
 * 2. 校验当前用户是 initiatorUserId 或 responderUserId
 * 3. 校验 resultSharedToInitiator=true（A 必须先等 B 分享）
 * 4. 更新 PairSession：unlocked=true, unlockMethod='free'
 * 5. 返回更新后的 ResultData（同 /api/pair/result）
 *
 * 说明：
 * - 配对完成时 PairSession.unlocked 已默认为 true（见 /api/test/submit），正常走幂等分支。
 * - method 仍接受 'free' / 'pay' / 'ad'，仅用于向后兼容前端旧版本，实际不再区分付费/广告渠道，
 *   一律按 'free' 写入 unlockMethod。
 * - 幂等：已解锁状态下重复调用直接返回当前 ResultData。
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { buildResultData } from '@/lib/pair-result';
import type { ApiResponse, UnlockMethod } from '@/shared/types';

interface UnlockBody {
  pairSessionId: string;
  method: UnlockMethod;
}

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as UnlockBody;
    if (!body.pairSessionId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 pairSessionId' },
        { status: 400 },
      );
    }
    // B-WC-1：MVP 阶段免费解锁，接受 'free' / 'pay' / 'ad' 任一值（向后兼容前端旧版本）
    if (
      body.method !== 'free' &&
      body.method !== 'pay' &&
      body.method !== 'ad'
    ) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'method 参数无效' },
        { status: 400 },
      );
    }

    const pair = await prisma.pairSession.findUnique({
      where: { id: body.pairSessionId },
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

    // 校验：B 必须先分享给 A
    if (!pair.resultSharedToInitiator) {
      return NextResponse.json<ApiResponse>(
        // W-WC-2 修复：原「请先等 TA 分享解锁基础结果」违反微信运营规范，改为温和措辞
        { success: false, error: '请先等 TA 把结果发给你' },
        { status: 400 },
      );
    }

    // 幂等：已解锁直接返回当前结果（MVP 阶段配对完成即 unlocked=true，正常走此分支）
    if (pair.unlocked) {
      const data = await buildResultData(pair, userId);
      return NextResponse.json<ApiResponse<typeof data>>({
        success: true,
        data,
      });
    }

    // 兜底：旧数据 unlocked=false 时免费解锁（一律按 'free' 写入）
    const updated = await prisma.pairSession.update({
      where: { id: pair.id },
      data: {
        unlocked: true,
        unlockMethod: 'free',
      },
      include: {
        coupleType: true,
        initiatorUser: { select: { nickname: true, avatarUrl: true } },
        responderUser: { select: { nickname: true, avatarUrl: true } },
      },
    });

    const data = await buildResultData(updated, userId);

    return NextResponse.json<ApiResponse<typeof data>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '解锁失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
