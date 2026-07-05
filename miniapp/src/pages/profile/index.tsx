/**
 * 我的页（tab）
 * - 用户信息（昵称、头像、性别）
 * - 订阅状态（¥39/月 或 ¥298/年）
 * - 我的关系（已配对/未配对）
 * - 设置：清除缓存、关于、反馈
 */
import { useState } from 'react';
import { View, Text, Image, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { http } from '@/lib/request';
import { isLoggedIn, getCurrentUser, logout, silentLogin } from '@/lib/auth';
import './index.scss';

interface UserProfile {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  gender: string | null;
  age: number | null;
  status: string | null;
}

interface SubscriptionInfo {
  plan: 'free' | 'monthly' | 'yearly';
  expiresAt?: string;
  autoRenew?: boolean;
}

interface PairSummary {
  pairSessionId: string;
  coupleTypeName?: string;
  coupleTypeEmoji?: string;
  compatibility?: number;
  partnerNickname?: string;
  status: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [pair, setPair] = useState<PairSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    loadAll();
  });

  const loadAll = async () => {
    if (!isLoggedIn()) {
      // 尝试静默登录
      await silentLogin();
    }
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }
    const [u, s, p] = await Promise.all([
      getCurrentUser(),
      http.get<SubscriptionInfo>('/api/subscription').catch(() => null),
      http.get<PairSummary>('/api/pair/mine').catch(() => null),
    ]);
    setUser(u);
    setSub(s);
    setPair(p);
    setLoading(false);
  };

  /** 授权登录 */
  const doLogin = async () => {
    await silentLogin();
    await loadAll();
  };

  /** 订阅：跳转到订阅管理页 */
  const goSubscribe = (_plan: 'monthly' | 'yearly') => {
    Taro.navigateTo({ url: '/pages/subscription/index' });
  };

  /** 退出登录 */
  const doLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '退出后需要重新登录',
      success: (r) => {
        if (r.confirm) {
          logout();
          setUser(null);
          setSub(null);
          setPair(null);
        }
      },
    });
  };

  /** 清除测试缓存 */
  const clearCache = () => {
    Taro.showModal({
      title: '清除缓存',
      content: '将清除未提交的测试进度',
      success: (r) => {
        if (r.confirm) {
          Taro.removeStorageSync('test_progress_v2');
          Taro.showToast({ title: '已清除', icon: 'success' });
        }
      },
    });
  };

  /** 编辑性别：ActionSheet 选择后调 PUT /api/auth/me 更新 */
  const editGender = () => {
    if (!user) return;
    Taro.showActionSheet({
      itemList: ['男', '女', '其他'],
      success: async (res) => {
        const genderMap: Record<number, string> = {
          0: 'male',
          1: 'female',
          2: 'other',
        };
        const gender = genderMap[res.tapIndex];
        if (!gender || gender === user.gender) return;
        Taro.showLoading({ title: '更新中' });
        try {
          const updated = await http.put<UserProfile>('/api/auth/me', { gender });
          setUser(updated);
          Taro.showToast({ title: '已更新', icon: 'success' });
        } catch (e) {
          Taro.showToast({
            title: (e as Error).message || '更新失败',
            icon: 'none',
          });
        } finally {
          Taro.hideLoading();
        }
      },
    });
  };

  if (loading) {
    return (
      <View className='profile loading'>
        <Text className='text-muted'>加载中...</Text>
      </View>
    );
  }

  return (
    <View className='profile'>
      {/* 用户信息卡 */}
      <View className='card user-card'>
        {user ? (
          <View className='user-info'>
            <Image
              className='avatar'
              src={user.avatarUrl || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='}
              mode='aspectFill'
            />
            <View className='user-meta'>
              <Text className='nickname'>{user.nickname || '未设置昵称'}</Text>
              <Text className='sub text-muted'>
                {user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '未设置性别'}
                {user.status ? ` · ${user.status}` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View className='login-cta'>
            <Text className='card-title'>登录后开始你的关系成长之旅</Text>
            <Button className='btn-primary' openType='getUserInfo' onClick={doLogin}>
              微信登录
            </Button>
          </View>
        )}
      </View>

      {/* 我的关系 */}
      {user && (
        <View className='card'>
          <Text className='section-title'>我的关系</Text>
          {pair ? (
            <View className='pair-info'>
              {pair.coupleTypeEmoji ? <Text className='pair-emoji'>{pair.coupleTypeEmoji}</Text> : null}
              <View className='pair-meta'>
                <Text className='pair-type'>
                  {pair.coupleTypeName ? `「${pair.coupleTypeName}」` : '已配对'}
                </Text>
                <Text className='pair-desc text-muted'>
                  {pair.compatibility != null
                    ? `默契度 ${pair.compatibility}/100`
                    : '结果未解锁'}
                </Text>
              </View>
              <Button
                className='btn-ghost btn-sm'
                onClick={() =>
                  Taro.navigateTo({
                    url: `/pages/result/index?pairSessionId=${pair.pairSessionId}`,
                  })
                }
              >
                查看
              </Button>
            </View>
          ) : (
            <View>
              <Text className='card-desc text-muted'>
                还没有配对，去做测试并邀请 TA
              </Text>
              <Button
                className='btn-ghost'
                onClick={() => Taro.navigateTo({ url: '/pages/test/index' })}
              >
                去做测试
              </Button>
            </View>
          )}
        </View>
      )}

      {/* 订阅 */}
      {user && (
        <View className='card'>
          <Text className='section-title'>订阅状态</Text>
          {sub && sub.plan !== 'free' ? (
            <View>
              <Text className='sub-active'>
                {sub.plan === 'monthly' ? '月度订阅' : '年度订阅'} 已激活
              </Text>
              {sub.expiresAt && (
                <Text className='sub-expire text-muted'>
                  到期时间：{sub.expiresAt}
                </Text>
              )}
            </View>
          ) : (
            <View className='sub-plans'>
              <View className='plan-item'>
                <Text className='plan-name'>月度</Text>
                <Text className='plan-price'>¥39/月</Text>
                <Button className='btn-ghost btn-sm' onClick={() => goSubscribe('monthly')}>
                  订阅
                </Button>
              </View>
              <View className='plan-item recommend'>
                <Text className='plan-name'>年度</Text>
                <Text className='plan-price'>¥298/年</Text>
                <Text className='plan-tag'>省 ¥170</Text>
                <Button className='btn-primary btn-sm' onClick={() => goSubscribe('yearly')}>
                  订阅
                </Button>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 设置 */}
      {user && (
        <View className='card settings'>
          <View className='setting-item' onClick={editGender}>
            <Text>编辑性别</Text>
            <Text className='setting-value text-muted'>
              {user.gender === 'male'
                ? '男'
                : user.gender === 'female'
                  ? '女'
                  : user.gender === 'other'
                    ? '其他'
                    : '未设置'}
            </Text>
          </View>
          <View className='setting-item' onClick={clearCache}>
            <Text>清除缓存</Text>
          </View>
          <View
            className='setting-item'
            onClick={() => Taro.showToast({ title: '开发中', icon: 'none' })}
          >
            <Text>关于问心 AI</Text>
          </View>
          <View
            className='setting-item'
            onClick={() => Taro.showToast({ title: '开发中', icon: 'none' })}
          >
            <Text>意见反馈</Text>
          </View>
          <View className='setting-item danger' onClick={doLogout}>
            <Text>退出登录</Text>
          </View>
        </View>
      )}
    </View>
  );
}
