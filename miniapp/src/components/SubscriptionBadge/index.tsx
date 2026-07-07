/**
 * 订阅状态徽章
 *
 * 在 result / tasks 页面顶部显示「已订阅 · 全部解锁」标记。
 * 仅当 isSubscribed=true 时渲染,否则返回 null。
 *
 * V3 暖玫瑰配色:#E8758A 主色 + Heart 图标。
 */
import { View, Text } from '@tarojs/components';
import './index.scss';

export interface SubscriptionBadgeProps {
  isSubscribed: boolean;
}

export default function SubscriptionBadge({
  isSubscribed,
}: SubscriptionBadgeProps) {
  if (!isSubscribed) return null;
  return (
    <View className='subscription-badge'>
      <Text className='badge-text'>已订阅 · 全部解锁</Text>
    </View>
  );
}
