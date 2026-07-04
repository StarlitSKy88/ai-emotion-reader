/**
 * 订阅状态查询（Phase 5.3.5 后端）
 * GET /api/subscription/status
 *
 * 返回当前用户的订阅信息 + 套餐配置，供订阅管理页展示。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import {
  getUserSubscription,
  isSubscriptionActive,
  SUBSCRIPTION_PRODUCTS,
} from '@/lib/subscription';
import type { ApiResponse, SubscriptionInfo, SubscriptionPlan } from '@/shared/types';

interface StatusData {
  /** 当前订阅信息（含过期修正） */
  subscription: SubscriptionInfo;
  /** 是否有效订阅 */
  active: boolean;
  /** 剩余天数（active 时才有意义，已过期为 0） */
  remainingDays: number;
  /** 套餐配置 */
  products: Record<
    SubscriptionPlan,
    {
      amountFen: number;
      amountYuan: string;
      months: number;
      description: string;
    }
  >;
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

    const subscription = await getUserSubscription(userId);
    const active = isSubscriptionActive(subscription);

    // 计算剩余天数
    let remainingDays = 0;
    if (active && subscription.currentPeriodEnd) {
      const endMs = Date.parse(subscription.currentPeriodEnd);
      if (!Number.isNaN(endMs)) {
        remainingDays = Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000));
        if (remainingDays < 0) remainingDays = 0;
      }
    }

    const data: StatusData = {
      subscription,
      active,
      remainingDays,
      products: {
        monthly: {
          amountFen: SUBSCRIPTION_PRODUCTS.monthly.amountFen,
          amountYuan: '¥39',
          months: SUBSCRIPTION_PRODUCTS.monthly.months,
          description: SUBSCRIPTION_PRODUCTS.monthly.description,
        },
        yearly: {
          amountFen: SUBSCRIPTION_PRODUCTS.yearly.amountFen,
          amountYuan: '¥298',
          months: SUBSCRIPTION_PRODUCTS.yearly.months,
          description: SUBSCRIPTION_PRODUCTS.yearly.description,
        },
      },
    };

    return NextResponse.json<ApiResponse<StatusData>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询订阅状态失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
