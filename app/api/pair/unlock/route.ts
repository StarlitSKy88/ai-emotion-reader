/**
 * 解锁配对结果
 * POST /api/pair/unlock
 * body: { pairSessionId, tier: 'basic' | 'deep', method?: 'ad' | 'pay' }
 *
 * V3 商业化:
 * - 阶段1:全免费,直接标记解锁
 * - 阶段2/3:未订阅=看广告解锁,已订阅=免费解锁
 *
 * 逻辑:
 * 1. 需登录
 * 2. 校验当前用户是 initiatorUserId 或 responderUserId
 * 3. 校验 resultSharedToInitiator=true（A 必须先等 B 分享）
 * 4. 调 resolveUnlockMethod 判断解锁方式
 * 5. 更新 PairSession 对应 tier 字段:
 *    - tier=basic → basicUnlockMethod + basicUnlockedAt
 *    - tier=deep  → deepUnlockMethod + deepUnlockedAt
 * 6. 返回更新后的 ResultData（同 /api/pair/result）
 *
 * 幂等:已解锁状态下重复调用直接返回当前 ResultData。
 *
 * 向后兼容:旧前端不传 tier 时默认按 'basic' 处理;旧 method 参数忽略,
 * 一律以 resolveUnlockMethod 计算结果为准。
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { buildResultData } from '@/lib/pair-result';
import {
  resolveUnlockMethod,
  isUserSubscribed,
  type UnlockTier,
  type UnlockMethod as CommercialUnlockMethod,
} from '@/lib/commercial-policy';
import type { ApiResponse, UnlockMethod } from '@/shared/types';

interface UnlockBody {
  pairSessionId: string;
  tier?: UnlockTier;
  /** 旧参数,向后兼容,实际不再使用 */
  method?: UnlockMethod;
}

/** 校验 tier 参数 */
function isValidTier(tier: unknown): tier is UnlockTier {
  return tier === 'basic' || tier === 'deep';
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

    // V3:tier 必传,旧前端未传时默认 basic
    const tier: UnlockTier = isValidTier(body.tier) ? body.tier : 'basic';

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

    // 权限:必须是 A 或 B
    const isInitiator = pair.initiatorUserId === userId;
    const isResponder = pair.responderUserId === userId;
    if (!isInitiator && !isResponder) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 校验:B 必须先分享给 A
    if (!pair.resultSharedToInitiator) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '请先等 TA 把结果发给你' },
        { status: 400 },
      );
    }

    // 查当前用户订阅状态
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscription: true },
    });
    const isSubscribed = isUserSubscribed(user?.subscription);

    // 计算 V3 解锁方式
    const resolvedMethod: CommercialUnlockMethod = resolveUnlockMethod(
      tier,
      isSubscribed,
    );

    // 判断当前 tier 是否已解锁(V3 新字段)
    const alreadyUnlocked =
      tier === 'basic'
        ? !!pair.basicUnlockedAt
        : !!pair.deepUnlockedAt;

    // 幂等:已解锁直接返回当前结果
    if (alreadyUnlocked) {
      const data = await buildResultData(pair, userId);
      return NextResponse.json<ApiResponse<typeof data>>({
        success: true,
        data,
      });
    }

    // 更新对应 tier 的解锁字段
    // 旧字段 unlocked/unlockMethod 同步更新(basic 解锁时),保持旧前端兼容
    const now = new Date();
    const updateData: Record<string, unknown> =
      tier === 'basic'
        ? {
            basicUnlockMethod: resolvedMethod,
            basicUnlockedAt: now,
            // 同步旧字段
            unlocked: true,
            unlockMethod: resolvedMethod,
          }
        : {
            deepUnlockMethod: resolvedMethod,
            deepUnlockedAt: now,
            // deep 解锁同时确保旧字段 unlocked=true(深度内容可见)
            unlocked: true,
            unlockMethod: resolvedMethod,
          };

    const updated = await prisma.pairSession.update({
      where: { id: pair.id },
      data: updateData,
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
