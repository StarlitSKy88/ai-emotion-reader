/**
 * 订阅管理页（Phase 5.3.5）
 * - 显示当前订阅状态（套餐 / 到期时间 / 剩余天数）
 * - 套餐选择（月度 ¥39 / 年度 ¥298）
 * - 拉起微信支付（调 /api/subscription/create + wx.requestPayment）
 *
 * 注：微信小程序订阅为一次性购买，到期后需手动续费，不会自动扣款。
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

interface StatusData {
  subscription: {
    plan: 'monthly' | 'yearly' | null;
    status: 'active' | 'expired' | 'canceled' | 'none';
    currentPeriodEnd: string | null;
    autoRenew: boolean;
  };
  active: boolean;
  remainingDays: number;
  products: Record<
    'monthly' | 'yearly',
    {
      amountFen: number;
      amountYuan: string;
      months: number;
      description: string;
    }
  >;
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
  const [paying, setPaying] = useState<'monthly' | 'yearly' | null>(null);

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

  /** 发起订阅支付 */
  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    if (paying) return;
    setPaying(plan);
    trackSubscribeClick(plan);
    try {
      const data = await http.post<CreateData>('/api/subscription/create', { plan });

      // mock 模式：直接提示激活成功，重新加载状态
      if (data.mock) {
        trackSubscribeSuccess(plan, data.amountFen);
        Taro.showToast({ title: 'mock 模式已激活', icon: 'success' });
        await loadStatus();
        return;
      }

      // 真实支付：调 wx.requestPayment
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

      trackSubscribeSuccess(plan, data.amountFen);
      Taro.showToast({ title: '订阅成功', icon: 'success' });
      // 等回调激活后重新加载状态（回调可能有延迟，1s 后重试）
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
      setPaying(null);
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
  const currentPlan = sub?.plan;

  return (
    <View className='subscription'>
      <View className='sub-header'>
        <Text className='sub-title'>问心 AI 会员</Text>
        <Text className='sub-subtitle'>解锁完整成长报告 + 无限任务总结</Text>
      </View>

      {/* 当前订阅状态 */}
      {sub && (
        <View className='sub-status-card'>
          <Text className={`status-badge ${sub.status}`}>
            {isActive ? '订阅中' : sub.status === 'expired' ? '已过期' : sub.status === 'canceled' ? '已取消' : '未订阅'}
          </Text>
          <Text className='status-plan'>
            {currentPlan === 'monthly' ? '月度订阅' : currentPlan === 'yearly' ? '年度订阅' : '尚未订阅'}
          </Text>
          {isActive && sub.currentPeriodEnd && (
            <Text className='status-expire'>
              到期时间：{formatExpire(sub.currentPeriodEnd)}（剩 {status?.remainingDays} 天）
            </Text>
          )}
        </View>
      )}

      {/* 套餐选择 */}
      <View className='plans'>
        {/* 月度 */}
        <View className='plan-card'>
          <View className='plan-header'>
            <Text className='plan-name'>月度订阅</Text>
            <Text className='plan-price'>
              ¥39<span className='plan-unit'>/月</span>
            </Text>
          </View>
          <Text className='plan-desc'>适合想先体验一段时间的你</Text>
          <View className='plan-features'>
            <Text className='feature-item'>完整 7 天 / 30 天成长报告</Text>
            <Text className='feature-item'>无限任务默契度总结</Text>
            <Text className='feature-item'>每日任务生成</Text>
          </View>
          <Button
            className={`plan-cta ${currentPlan === 'monthly' && isActive ? 'btn-current' : ''}`}
            disabled={paying !== null || (currentPlan === 'monthly' && isActive)}
            loading={paying === 'monthly'}
            onClick={() => handleSubscribe('monthly')}
          >
            {currentPlan === 'monthly' && isActive ? '当前套餐' : '订阅月度'}
          </Button>
        </View>

        {/* 年度（推荐） */}
        <View className='plan-card recommend'>
          <Text className='recommend-tag'>省 ¥170</Text>
          <View className='plan-header'>
            <Text className='plan-name'>年度订阅</Text>
            <Text className='plan-price'>
              ¥298<span className='plan-unit'>/年</span>
            </Text>
          </View>
          <Text className='plan-desc'>相当于 ¥24.8/月，最受欢迎</Text>
          <View className='plan-features'>
            <Text className='feature-item'>月度全部权益</Text>
            <Text className='feature-item'>省 ¥170（相比月度）</Text>
            <Text className='feature-item'>优先体验新功能</Text>
          </View>
          <Button
            className={`plan-cta ${currentPlan === 'yearly' && isActive ? 'btn-current' : ''}`}
            disabled={paying !== null || (currentPlan === 'yearly' && isActive)}
            loading={paying === 'yearly'}
            onClick={() => handleSubscribe('yearly')}
          >
            {currentPlan === 'yearly' && isActive ? '当前套餐' : '订阅年度'}
          </Button>
        </View>
      </View>

      {/* 底部说明 */}
      <View className='sub-footer'>
        <Text className='sub-tip'>
          · 订阅期间可继续使用全部功能
        </Text>
        <Text className='sub-tip'>
          · 到期后需手动续费，不会自动扣款
        </Text>
        <Text className='sub-tip'>
          · 如有疑问可在「我的 → 关于」联系客服
        </Text>
      </View>
    </View>
  );
}
