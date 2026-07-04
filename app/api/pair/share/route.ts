/**
 * B 分享给 A
 * POST /api/pair/share
 *
 * body: { pairSessionId }
 *
 * 逻辑：
 * 1. 需登录
 * 2. 校验当前用户是 responderUserId（仅 B 可发起分享）
 * 3. 更新 resultSharedToInitiator = true
 * 4. 返回 { success: true }
 *
 * 说明：B 始终可分享，不需要 A 同意。
 * 幂等：已分享状态下重复调用直接返回成功。
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { ApiResponse } from '@/shared/types';

interface ShareBody {
  pairSessionId: string;
}

interface ShareData {
  success: boolean;
  /** 是否首次分享（之前未分享，本次更新为 true） */
  firstTime: boolean;
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

    const body = (await request.json()) as ShareBody;
    if (!body.pairSessionId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 pairSessionId' },
        { status: 400 },
      );
    }

    const pair = await prisma.pairSession.findUnique({
      where: { id: body.pairSessionId },
      select: { id: true, responderUserId: true, resultSharedToInitiator: true },
    });

    if (!pair) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '配对记录不存在' },
        { status: 404 },
      );
    }

    // 仅 B（responder）可分享
    if (pair.responderUserId !== userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '只有被邀请方可以分享结果' },
        { status: 403 },
      );
    }

    // 幂等：已分享直接返回
    if (pair.resultSharedToInitiator) {
      return NextResponse.json<ApiResponse<ShareData>>({
        success: true,
        data: { success: true, firstTime: false },
      });
    }

    // 修复 W-4：用 updateMany + where 条件保证并发安全
    // 两个并发请求都读到 resultSharedToInitiator=false 时，
    // 只有一个 updateMany 能命中（count=1，firstTime=true），
    // 另一个 count=0（firstTime=false），避免双返回 true。
    const updateResult = await prisma.pairSession.updateMany({
      where: { id: pair.id, resultSharedToInitiator: false },
      data: { resultSharedToInitiator: true },
    });
    const firstTime = updateResult.count > 0;

    return NextResponse.json<ApiResponse<ShareData>>({
      success: true,
      data: { success: true, firstTime },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '分享失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
