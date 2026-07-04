/**
 * 订阅下单（Phase 5.3.2）
 * POST /api/subscription/create
 *
 * body: { plan: 'monthly' | 'yearly' }
 *
 * 流程：
 * 1. 需登录
 * 2. 校验 plan 参数
 * 3. 取当前用户 openid
 * 4. 调 createSubscriptionOrder 创建微信支付订单
 * 5. 在 User.subscription 写入 pendingOrder（回调时校验）
 * 6. 返回小程序支付参数
 *
 * 前端拿到 PayParams 后调 wx.requestPayment 拉起支付，
 * 支付成功后微信会回调 /api/subscription/notify，由回调激活订阅。
 *
 * 开发环境（缺支付环境变量）：返回 mock 参数，前端可直接调 /api/subscription/activate mock 激活。
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import {
  createSubscriptionOrder,
  isMockPayMode,
  type PayParams,
} from '@/lib/wechat-pay';
import {
  parseSubscriptionInfo,
  SUBSCRIPTION_PRODUCTS,
} from '@/lib/subscription';
import type { ApiResponse, SubscriptionPlan } from '@/shared/types';

interface CreateBody {
  plan?: SubscriptionPlan;
}

interface CreateData extends PayParams {
  /** 是否 mock 模式（前端可直接调 /api/subscription/activate 跳过支付） */
  mock: boolean;
  /** 套餐 */
  plan: SubscriptionPlan;
  /** 金额（分） */
  amountFen: number;
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

    const body = (await request.json()) as CreateBody;
    const plan: SubscriptionPlan =
      body.plan === 'monthly' || body.plan === 'yearly' ? body.plan : 'monthly';

    // 取当前用户 openid
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { openid: true, subscription: true },
    });
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户不存在' },
        { status: 404 },
      );
    }
    if (!user.openid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户未绑定微信，无法发起支付' },
        { status: 400 },
      );
    }

    // 创建微信支付订单
    const payParams = await createSubscriptionOrder(userId, plan, user.openid);

    // 在 User.subscription 写入 pendingOrder（回调时校验 + 防伪造）
    const currentSub = parseSubscriptionInfo(user.subscription);
    const updatedSub = {
      ...currentSub,
      pendingOrder: {
        outTradeNo: payParams.outTradeNo,
        plan,
        createdAt: new Date().toISOString(),
      },
    };
    await prisma.user.update({
      where: { id: userId },
      data: { subscription: updatedSub as never },
    });

    const data: CreateData = {
      ...payParams,
      mock: isMockPayMode(),
      plan,
      amountFen: SUBSCRIPTION_PRODUCTS[plan].amountFen,
    };

    return NextResponse.json<ApiResponse<CreateData>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '订阅下单失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
