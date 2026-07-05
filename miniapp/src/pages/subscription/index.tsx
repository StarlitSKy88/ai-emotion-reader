/**
 * 订阅管理页 · V3 商业化
 *
 * 单一订阅产品:¥19.9 / 30 天
 * - 去广告 + 全部解锁(basic + deep) + 30 天成长报告
 *
 * 流程:
 * 1. 显示当前订阅状态(剩余天数)
 * 2. 点击订阅 → POST /api/subscription/create
 * 3. 拿到 PayParams 后调 wx.requestPayment
 * 4. 支付成功后重新加载状态
 *
 * 注:
 * - V3 价格 ¥19.9 = 1990 分(常量 V3_PRICE_FEN)
 * - 后端 SubscriptionPlan 类型仍为 'monthly' | 'yearly',前端按 'monthly' 调用,
 *   实际订单金额由后端 SUBSCRIPTION_PRODUCTS 决定(后端已改造或待改造为 1990)
 * - 微信小程序订阅为一次性购买,到期后需手动续费,不会自动扣款
 */
import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { http } from '@/lib/request';
import { isLoggedIn, silentLogin } from '@/lib/auth';
import {
  trackPageView,
  trackSubscribeClick,
  trackSubscribeSuccess,
} from '@/lib/track';
import './index.scss';

/** V3 订阅价格(分) · ¥19.9 = 1990 分 */
const V3_PRICE_FEN = 1990;
/** V3 订阅周期(天) */
const V3_DURATION_DAYS = 30;
/** V3 订阅价格(元,展示用) */
const V3_PRICE_YUAN = '¥19.9';
/** 调用后端 create 接口时使用的 plan(后端 SubscriptionPlan 类型限制) */
const V3_BACKEND_PLAN = 'monthly' as const;

interface StatusData {
  subscription: {
    plan: 'monthly' | 'yearly' | null;
    status: 'active' | 'expired' | 'canceled' | 'none';
    currentPeriodEnd: string | null;
    autoRenew: boolean;
  };
  active: boolean;
  remainingDays: number;
}

interface CreateData {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
  outTradeNo: string;
  prepayId: string;
  mock: boolean;
  plan: 'monthly' | 'yearly';
  amountFen: number;
}

export default function SubscriptionPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useDidShow(() => {
    trackPageView('pages/subscription/index');
    loadStatus();
  });

  const loadStatus = async () => {
    if (!isLoggedIn()) {
      await silentLogin();
    }
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }
    try {
      const data = await http.get<StatusData>('/api/subscription/status');
      setStatus(data);
    } catch (e) {
      Taro.showToast({
        title: (e as Error).message || '加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  /** 发起 V3 订阅支付(¥19.9 / 30 天) */
  const handleSubscribe = async () => {
    if (paying) return;
    setPaying(true);
    trackSubscribeClick(V3_BACKEND_PLAN);
    try {
      const data = await http.post<CreateData>('/api/subscription/create', {
        plan: V3_BACKEND_PLAN,
      });

      // mock 模式:直接提示激活成功,重新加载状态
      if (data.mock) {
        trackSubscribeSuccess(V3_BACKEND_PLAN, V3_PRICE_FEN);
        Taro.showToast({ title: 'mock 模式已激活', icon: 'success' });
        await loadStatus();
        return;
      }

      // 真实支付:调 wx.requestPayment
      await new Promise<void>((resolve, reject) => {
        Taro.requestPayment({
          timeStamp: data.timeStamp,
          nonceStr: data.nonceStr,
          package: data.package,
          signType: data.signType,
          paySign: data.paySign,
          success: () => resolve(),
          fail: (err) => reject(err),
        });
      });

      trackSubscribeSuccess(V3_BACKEND_PLAN, V3_PRICE_FEN);
      Taro.showToast({ title: '订阅成功', icon: 'success' });
      // 等回调激活后重新加载状态(回调可能有延迟,1s 后重试)
      setTimeout(() => {
        loadStatus();
      }, 1000);
    } catch (e) {
      const err = e as { errMsg?: string };
      // 用户取消支付不算错误
      if (err.errMsg?.includes('cancel')) {
        Taro.showToast({ title: '已取消支付', icon: 'none' });
      } else {
        Taro.showToast({
          title: (e as Error).message || '支付失败',
          icon: 'none',
        });
      }
    } finally {
      setPaying(false);
    }
  };

  /** 格式化到期时间 */
  const formatExpire = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View className='subscription loading'>
        <Text>加载中...</Text>
      </View>
    );
  }

  const sub = status?.subscription;
  const isActive = status?.active;

  return (
    <View className='subscription'>
      <View className='sub-header'>
        <Text className='sub-title'>问心 AI · 30 天畅享</Text>
        <Text className='sub-subtitle'>去广告 + 全部解锁 + 30 天成长报告</Text>
      </View>

      {/* 当前订阅状态 */}
      {sub && (
        <View className='sub-status-card'>
          <Text className={`status-badge ${sub.status}`}>
            {isActive ? '订阅中' : sub.status === 'expired' ? '已过期' : sub.status === 'canceled' ? '已取消' : '未订阅'}
          </Text>
          <Text className='status-plan'>
            {isActive ? `${V3_PRICE_YUAN} · 30 天畅享` : '尚未订阅'}
          </Text>
          {isActive && sub.currentPeriodEnd && (
            <Text className='status-expire'>
              到期时间:{formatExpire(sub.currentPeriodEnd)}(剩 {status?.remainingDays} 天)
            </Text>
          )}
        </View>
      )}

      {/* V3 单一订阅产品卡 */}
      <View className='plans'>
        <View className='plan-card recommend'>
          <Text className='recommend-tag'>30 天畅享</Text>
          <View className='plan-header'>
            <Text className='plan-name'>全部解锁套餐</Text>
            <Text className='plan-price'>
              {V3_PRICE_YUAN}<Text className='plan-unit'>/ {V3_DURATION_DAYS} 天</Text>
            </Text>
          </View>
          <Text className='plan-desc'>去广告 + 全部解锁 + 30 天成长报告</Text>
          <View className='plan-features'>
            <Text className='feature-item'>去除所有广告,体验更沉浸</Text>
            <Text className='feature-item'>basic + deep 内容全部解锁</Text>
            <Text className='feature-item'>30 天每日任务 + 多维度解读报告</Text>
            <Text className='feature-item'>专属订阅徽章标识</Text>
          </View>
          <Button
            className={`plan-cta ${isActive ? 'btn-current' : ''}`}
            disabled={paying || isActive}
            loading={paying}
            onClick={handleSubscribe}
          >
            {isActive ? '当前已订阅' : `立即订阅 ${V3_PRICE_YUAN}`}
          </Button>
        </View>
      </View>

      {/* 底部说明 */}
      <View className='sub-footer'>
        <Text className='sub-tip'>
          · 订阅期间去除所有广告,全部内容解锁
        </Text>
        <Text className='sub-tip'>
          · 到期后需手动续费,不会自动扣款
        </Text>
        <Text className='sub-tip'>
          · 如有疑问可在「我的 → 关于」联系客服
        </Text>
      </View>
    </View>
  );
}
