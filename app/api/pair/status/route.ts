/**
 * A 查看自己的配对状态
 * GET /api/pair/status?testSessionId=...
 *
 * invite 页调用，A 答完测试后轮询自己的 PairSession 状态。
 *
 * 返回：{
 *   pairSessionId: string | null;
 *   status: 'pending' | 'completed' | 'expired' | 'none';
 *   isInitiator: true;  // A 视角
 *   unlocked: boolean;  // B 是否已分享
 *   partnerNickname?: string;
 *   partnerAvatar?: string;
 *   compatibility?: number;
 * }
 *
 * 逻辑：
 * 1. 需登录
 * 2. 校验 testSessionId 是当前用户的
 * 3. 查 PairSession where initiatorId = testSessionId
 * 4. 不存在 → status='none'
 *    存在 → 根据 PairSession.status 和 resultSharedToInitiator 返回
 *    partner 信息从 responderUserId 关联 User 表取
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { ApiResponse, PairStatus } from '@/shared/types';

interface StatusData {
  pairSessionId: string | null;
  status: PairStatus | 'none';
  isInitiator: true;
  /** B 是否已分享结果给 A */
  unlocked: boolean;
  partnerNickname?: string;
  partnerAvatar?: string;
  compatibility?: number;
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

    const testSessionId = request.nextUrl.searchParams.get('testSessionId');
    if (!testSessionId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 testSessionId 参数' },
        { status: 400 },
      );
    }

    // 校验 testSessionId 属于当前用户
    const testSession = await prisma.testSession.findUnique({
      where: { id: testSessionId },
      select: { userId: true },
    });
    if (!testSession) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '测试记录不存在' },
        { status: 404 },
      );
    }
    if (testSession.userId !== userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 查 PairSession（initiatorId 是 @unique，最多一条）
    const pair = await prisma.pairSession.findUnique({
      where: { initiatorId: testSessionId },
      select: {
        id: true,
        status: true,
        resultSharedToInitiator: true,
        compatibility: true,
        responderUser: {
          select: {
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!pair) {
      const data: StatusData = {
        pairSessionId: null,
        status: 'none',
        isInitiator: true,
        unlocked: false,
      };
      return NextResponse.json<ApiResponse<StatusData>>({
        success: true,
        data,
      });
    }

    const data: StatusData = {
      pairSessionId: pair.id,
      status: pair.status as PairStatus,
      isInitiator: true,
      unlocked: pair.resultSharedToInitiator,
      partnerNickname: pair.responderUser?.nickname ?? undefined,
      partnerAvatar: pair.responderUser?.avatarUrl ?? undefined,
      compatibility: pair.compatibility ?? undefined,
    };

    return NextResponse.json<ApiResponse<StatusData>>({
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
