/**
 * 我的配对
 * GET /api/pair/mine
 *
 * profile 页调用，返回当前用户最近的配对（作为 A 或 B）。
 *
 * 返回：{
 *   pairSessionId: string;
 *   coupleTypeName?: string;
 *   coupleTypeEmoji?: string;
 *   compatibility?: number;
 *   partnerNickname?: string;
 *   status: string;
 * }
 *
 * 逻辑：
 * 1. 需登录
 * 2. 查 PairSession where initiatorUserId=userId OR responderUserId=userId，按 createdAt desc 取第一条
 * 3. 无配对返回 404
 *
 * partner 信息：
 * - 当前用户是 A → 取 B 的昵称
 * - 当前用户是 B → 取 A 的昵称
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { ApiResponse } from '@/shared/types';

interface MineData {
  pairSessionId: string;
  coupleTypeName?: string;
  coupleTypeEmoji?: string;
  compatibility?: number;
  partnerNickname?: string;
  status: string;
  /** B 是否已分享结果给 A（status=completed 时用于区分首页文案） */
  resultSharedToInitiator?: boolean;
  /** 是否已付费解锁深度内容 */
  unlocked?: boolean;
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

    // 查最近一条 PairSession（A 或 B）
    const pair = await prisma.pairSession.findFirst({
      where: {
        OR: [{ initiatorUserId: userId }, { responderUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        compatibility: true,
        initiatorUserId: true,
        resultSharedToInitiator: true,
        unlocked: true,
        coupleType: {
          select: { name: true, emoji: true },
        },
        initiatorUser: {
          select: { nickname: true },
        },
        responderUser: {
          select: { nickname: true },
        },
      },
    });

    if (!pair) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '暂无配对记录' },
        { status: 404 },
      );
    }

    // 当前用户是 A 还是 B，取对方的昵称
    const isInitiator = pair.initiatorUserId === userId;
    const partnerNickname = isInitiator
      ? (pair.responderUser?.nickname ?? undefined)
      : (pair.initiatorUser?.nickname ?? undefined);

    const data: MineData = {
      pairSessionId: pair.id,
      coupleTypeName: pair.coupleType?.name ?? undefined,
      coupleTypeEmoji: pair.coupleType?.emoji ?? undefined,
      compatibility: pair.compatibility ?? undefined,
      partnerNickname,
      status: pair.status,
      resultSharedToInitiator: pair.resultSharedToInitiator,
      unlocked: pair.unlocked,
    };

    return NextResponse.json<ApiResponse<MineData>>({
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
