/**
 * 订阅状态校验服务（Phase 5.3.4 / 5.2.2 共用）
 *
 * 提供「用户当前是否为有效订阅」判断能力，供报告付费墙、报告分享等场景调用。
 *
 * 订阅信息存储：User.subscription（Json 字段，结构对齐 SubscriptionInfo）
 * - 未订阅：{} 或 status='none'
 * - 已订阅：status='active'，currentPeriodEnd > now
 * - 已过期：status='expired' 或 currentPeriodEnd <= now
 *
 * 注：不引入独立 Subscription 表，复用 User.subscription Json 字段。
 * 理由：MVP 阶段订阅记录只有 1 条/用户，用 Json 字段足够；
 * V2 需要历史订阅记录/退款/续费日志时再独立建表。
 */
import { prisma } from '@/lib/prisma';
import type {
  SubscriptionInfo,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@/shared/types';

/**
 * 订阅产品配置（V3:¥19.9/30天,取消年付）
 *
 * V3 改造:
 * - 价格 ¥39 → ¥19.9(1990 分)
 * - 周期 1 个月 → 30 天(用 months=1 近似,activateSubscription 用 setMonth 续期,30 天 ≈ 1 月)
 * - 取消 yearly(保留类型兼容,但不再销售)
 * - description 改为 V3 文案
 */
export const SUBSCRIPTION_PRODUCTS = {
  monthly: {
    /** 金额（分）：¥19.9 = 1990 分 */
    amountFen: 1990,
    /** 周期月数（30 天 ≈ 1 月,setMonth 续期） */
    months: 1,
    /** 商品描述 */
    description: '问心 AI 30 天订阅(去广告 + 全部解锁)',
  },
  yearly: {
    /** V3 已下架,保留字段避免类型破坏。新订阅不再创建 yearly 订单 */
    amountFen: 29800,
    months: 12,
    description: '问心 AI 年度订阅(已下架)',
  },
} as const satisfies Record<SubscriptionPlan, {
  amountFen: number;
  months: number;
  description: string;
}>;

/** 默认空订阅（未订阅状态） */
export const EMPTY_SUBSCRIPTION: SubscriptionInfo = {
  plan: null,
  status: 'none',
  currentPeriodStart: null,
  currentPeriodEnd: null,
  autoRenew: true,
  lastOutTradeNo: null,
};

/**
 * 从 Prisma User.subscription Json 字段安全解析 SubscriptionInfo
 * 兼容旧数据（{}、null、字段缺失）
 */
export function parseSubscriptionInfo(raw: unknown): SubscriptionInfo {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_SUBSCRIPTION };
  }
  const obj = raw as Record<string, unknown>;

  const plan = obj.plan === 'monthly' || obj.plan === 'yearly'
    ? (obj.plan as SubscriptionPlan)
    : null;

  const status = ['active', 'expired', 'canceled', 'none'].includes(obj.status as string)
    ? (obj.status as SubscriptionStatus)
    : 'none';

  const currentPeriodStart =
    typeof obj.currentPeriodStart === 'string' ? obj.currentPeriodStart : null;
  const currentPeriodEnd =
    typeof obj.currentPeriodEnd === 'string' ? obj.currentPeriodEnd : null;
  const lastOutTradeNo =
    typeof obj.lastOutTradeNo === 'string' ? obj.lastOutTradeNo : null;

  const autoRenew = typeof obj.autoRenew === 'boolean' ? obj.autoRenew : true;

  return {
    plan,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    autoRenew,
    lastOutTradeNo,
  };
}

/**
 * 判断用户当前是否为有效订阅
 *
 * 有效定义：
 * - status === 'active'
 * - currentPeriodEnd > now（未过期）
 *
 * 兼容历史数据：
 * - status='active' 但 currentPeriodEnd 已过 → 视为 expired
 */
export function isSubscriptionActive(info: SubscriptionInfo): boolean {
  if (info.status !== 'active') return false;
  if (!info.currentPeriodEnd) return false;
  const endMs = Date.parse(info.currentPeriodEnd);
  if (Number.isNaN(endMs)) return false;
  return endMs > Date.now();
}

/**
 * 计算订阅状态（带过期修正）
 *
 * 若 status='active' 但已过期，返回 'expired'；
 * 否则返回原 status。
 */
export function getEffectiveStatus(info: SubscriptionInfo): SubscriptionStatus {
  if (info.status !== 'active') return info.status;
  if (!info.currentPeriodEnd) return 'expired';
  const endMs = Date.parse(info.currentPeriodEnd);
  if (Number.isNaN(endMs)) return 'expired';
  return endMs > Date.now() ? 'active' : 'expired';
}

/**
 * 获取用户的订阅信息（含过期修正）
 *
 * 若发现 status='active' 但已过期，会同步写回 DB（避免下次再算一遍）。
 */
export async function getUserSubscription(
  userId: string,
): Promise<SubscriptionInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscription: true },
  });
  if (!user) return { ...EMPTY_SUBSCRIPTION };

  const info = parseSubscriptionInfo(user.subscription);
  const effectiveStatus = getEffectiveStatus(info);

  // 过期修正：写回 DB
  if (effectiveStatus !== info.status) {
    const updated: SubscriptionInfo = { ...info, status: effectiveStatus };
    await prisma.user.update({
      where: { id: userId },
      data: { subscription: updated as never },
    });
    return updated;
  }

  return info;
}

/**
 * 校验用户是否有权访问付费内容（报告完整版等）
 *
 * @returns true=有权限（订阅有效）；false=无权限（应触发付费墙）
 */
export async function hasPaidAccess(userId: string): Promise<boolean> {
  const info = await getUserSubscription(userId);
  return isSubscriptionActive(info);
}

/**
 * 计算订阅周期结束时间
 *
 * @param plan 套餐
 * @param startAt 起始时间（默认 now）
 * @returns ISO 字符串
 */
export function calculatePeriodEnd(
  plan: SubscriptionPlan,
  startAt: Date = new Date(),
): string {
  const months = SUBSCRIPTION_PRODUCTS[plan].months;
  const end = new Date(startAt);
  end.setMonth(end.getMonth() + months);
  return end.toISOString();
}

/**
 * 激活订阅（支付回调成功后调用）
 *
 * 续费逻辑：若当前订阅未过期，则在 currentPeriodEnd 基础上叠加；
 * 否则从 now 开始计算。
 */
export async function activateSubscription(
  userId: string,
  plan: SubscriptionPlan,
  outTradeNo: string,
): Promise<SubscriptionInfo> {
  const current = await getUserSubscription(userId);
  const now = new Date();

  // 续费：当前订阅未过期 → 在 currentPeriodEnd 基础上叠加
  let startAt = now;
  if (
    isSubscriptionActive(current) &&
    current.currentPeriodEnd
  ) {
    const endMs = Date.parse(current.currentPeriodEnd);
    if (!Number.isNaN(endMs) && endMs > now.getTime()) {
      startAt = new Date(endMs);
    }
  }

  const periodEnd = calculatePeriodEnd(plan, startAt);
  const updated: SubscriptionInfo = {
    plan,
    status: 'active',
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: periodEnd,
    autoRenew: true,
    lastOutTradeNo: outTradeNo,
  };

  await prisma.user.update({
    where: { id: userId },
    data: { subscription: updated as never },
  });

  return updated;
}
