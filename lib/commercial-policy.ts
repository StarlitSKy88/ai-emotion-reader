/**
 * V3 商业化策略
 *
 * 三阶段:
 * - stage1 (UV<1000):全免费,REWARDED_AD_ENABLED=false
 * - stage2 (1000<=UV<10000):看广告解锁,REWARDED_AD_ENABLED=true
 * - stage3 (UV>=10000):看广告 + ¥19.9/30天订阅
 */

export type CommercialStage = 'stage1' | 'stage2' | 'stage3';
export type UnlockTier = 'basic' | 'deep';
export type UnlockMethod = 'ad' | 'pay' | 'free';

/** 当前商业化阶段(从环境变量读取) */
export function getCommercialStage(): CommercialStage {
  const stage = process.env.COMMERCIAL_STAGE || 'stage1';
  if (stage === 'stage3') return 'stage3';
  if (stage === 'stage2') return 'stage2';
  return 'stage1';
}

/** 阶段1:全免费,无需广告 */
export function isFreeStage(): boolean {
  return getCommercialStage() === 'stage1';
}

/** 阶段2/3:启用广告 */
export function isAdEnabled(): boolean {
  const stage = getCommercialStage();
  return stage === 'stage2' || stage === 'stage3';
}

/** 阶段3:启用付费订阅 */
export function isSubscriptionEnabled(): boolean {
  return getCommercialStage() === 'stage3';
}

/** 判断用户是否已订阅(从 User.subscription Json 字段读) */
export function isUserSubscribed(subscription: unknown): boolean {
  if (!subscription || typeof subscription !== 'object') return false;
  const sub = subscription as Record<string, unknown>;
  if (sub.plan !== 'v3_monthly') return false;
  const expireAt = sub.expireAt as string | undefined;
  if (!expireAt) return false;
  return new Date(expireAt).getTime() > Date.now();
}

/** 获取用户解锁方法(基于阶段 + 订阅状态) */
export function resolveUnlockMethod(
  tier: UnlockTier,
  isSubscribed: boolean,
): UnlockMethod {
  // 阶段1:全免费
  if (isFreeStage()) return 'free';
  // 已订阅:免费解锁
  if (isSubscribed) return 'free';
  // 阶段2/3:看广告
  return 'ad';
}

/** 订阅价格(分) */
export const SUBSCRIPTION_PRICE_FEN = 1990; // ¥19.9

/** 订阅周期天数 */
export const SUBSCRIPTION_DURATION_DAYS = 30;
