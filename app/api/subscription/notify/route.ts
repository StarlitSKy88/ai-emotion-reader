/**
 * 订阅支付回调（Phase 5.3.3）
 * POST /api/subscription/notify
 *
 * 微信支付成功后回调此路由激活订阅。
 *
 * 流程：
 * 1. 验签（生产环境 fail-closed，与 /api/wechat/pay/notify 一致）
 * 2. 解密 resource 拿到 out_trade_no 和 trade_state
 * 3. 从 out_trade_no 反解 { userId, plan }
 * 4. 校验 pendingOrder.outTradeNo === out_trade_no（防伪造回调）
 * 5. 校验金额与 plan 匹配
 * 6. 调 activateSubscription 激活订阅（含续费叠加）
 * 7. 清除 pendingOrder
 * 8. 返回 200 { code: 'SUCCESS' }
 *
 * 幂等：微信会重复回调，已激活的订阅（pendingOrder 已清）直接返回 SUCCESS。
 *
 * 安全：
 * - 验签 fail-closed（生产环境无平台公钥 → 拒绝）
 * - pendingOrder 校验（防伪造 out_trade_no 激活任意用户订阅）
 * - 金额校验（防伪造金额低价订阅）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  decryptPayNotifyResource,
  isValidSubscriptionAmount,
  parseSubscriptionFromOutTradeNo,
  verifyNotifySignature,
} from '@/lib/wechat-pay';
import {
  activateSubscription,
  parseSubscriptionInfo,
  SUBSCRIPTION_PRODUCTS,
} from '@/lib/subscription';
import type { SubscriptionPlan } from '@/shared/types';

interface NotifyBody {
  id: string;
  create_time: string;
  event_type: string;
  resource_type: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    associated_data: string;
    nonce: string;
    original_type: string;
  };
}

interface PayResult {
  out_trade_no: string;
  trade_state: string;
  trade_state_desc?: string;
  amount?: { total: number; payer_total: number };
}

interface PendingOrder {
  outTradeNo: string;
  plan: SubscriptionPlan;
  createdAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.WECHAT_PAY_API_KEY;

    // 开发环境：缺 API_KEY 时直接返回成功（mock 模式不走真实回调）
    if (!apiKey) {
      return NextResponse.json(
        { code: 'SUCCESS', message: 'mock mode: no API_KEY configured' },
        { status: 200 },
      );
    }

    const rawBody = await request.text();

    // 验签
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    if (!verifyNotifySignature(headers, rawBody)) {
      return NextResponse.json(
        { code: 'FAIL', message: '签名校验失败' },
        { status: 401 },
      );
    }

    const body = JSON.parse(rawBody) as NotifyBody;
    if (!body?.resource?.ciphertext) {
      return NextResponse.json(
        { code: 'FAIL', message: 'resource 字段缺失' },
        { status: 400 },
      );
    }

    // 解密 resource
    let payResult: PayResult;
    try {
      payResult = decryptPayNotifyResource(
        {
          ciphertext: body.resource.ciphertext,
          nonce: body.resource.nonce,
          associated_data: body.resource.associated_data,
        },
        apiKey,
      ) as unknown as PayResult;
    } catch {
      return NextResponse.json(
        { code: 'FAIL', message: '解密失败' },
        { status: 400 },
      );
    }

    // 仅处理支付成功状态
    if (payResult.trade_state !== 'SUCCESS') {
      return NextResponse.json(
        { code: 'SUCCESS', message: `trade_state=${payResult.trade_state}` },
        { status: 200 },
      );
    }

    // 从 out_trade_no 反解 { userId, plan }
    const subInfo = parseSubscriptionFromOutTradeNo(payResult.out_trade_no);
    if (!subInfo) {
      return NextResponse.json(
        { code: 'FAIL', message: 'out_trade_no 无法解析订阅信息' },
        { status: 400 },
      );
    }

    // 金额校验
    if (!payResult.amount?.total || !isValidSubscriptionAmount(payResult.amount.total, subInfo.plan)) {
      return NextResponse.json(
        {
          code: 'FAIL',
          message: `金额不匹配: 套餐 ${subInfo.plan} 期望 ${SUBSCRIPTION_PRODUCTS[subInfo.plan].amountFen}, 实际 ${payResult.amount?.total}`,
        },
        { status: 400 },
      );
    }

    // 查用户（带 subscription 字段）
    const user = await prisma.user.findUnique({
      where: { id: subInfo.userId },
      select: { id: true, subscription: true },
    });
    if (!user) {
      // 用户不存在，仍返回 SUCCESS 避免微信重复回调
      return NextResponse.json(
        { code: 'SUCCESS', message: 'user not found' },
        { status: 200 },
      );
    }

    // 校验 pendingOrder.outTradeNo（防伪造回调）
    const currentSub = parseSubscriptionInfo(user.subscription);
    const pendingOrder = (user.subscription as { pendingOrder?: PendingOrder } | null)?.pendingOrder;
    if (!pendingOrder || pendingOrder.outTradeNo !== payResult.out_trade_no) {
      // pendingOrder 不匹配：可能是重复回调（已激活）或伪造回调
      // 幂等：直接返回 SUCCESS
      return NextResponse.json(
        { code: 'SUCCESS', message: 'pendingOrder mismatch (already activated or invalid)' },
        { status: 200 },
      );
    }

    // 激活订阅（含续费叠加）
    await activateSubscription(subInfo.userId, subInfo.plan, payResult.out_trade_no);

    // 清除 pendingOrder
    const cleanedSub = { ...currentSub, pendingOrder: undefined };
    await prisma.user.update({
      where: { id: subInfo.userId },
      data: { subscription: cleanedSub as never },
    });

    return NextResponse.json(
      { code: 'SUCCESS', message: 'OK' },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '回调处理失败';
    return NextResponse.json(
      { code: 'FAIL', message },
      { status: 500 },
    );
  }
}
