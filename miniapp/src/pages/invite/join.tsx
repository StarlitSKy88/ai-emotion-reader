/**
 * B 扫码后的路径选择页
 *
 * 流程：
 *   A 分享 → B 扫码/点链接 → 进入此页（带 inviterTestSessionId）
 *   → GET /api/pair/join/[testSessionId] 获取 A 信息 + 是否已被配对
 *   → 展示两个路径卡片：
 *     1. 「我是 TA 的伴侣」→ /pages/test/index?inviterTestSessionId=...（B 作为受邀方）
 *     2. 「我不是 TA 伴侣，我自己做」→ /pages/test/index（作为新发起人）
 *   → 如果 hasExistingPair=true（A 已被配对），只显示第二个路径
 */
import { useState } from 'react';
import { View, Text, Image, Button } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { http } from '@/lib/request';
import './join.scss';

interface JoinInfo {
  /** A 的性别 */
  inviterGender?: 'male' | 'female' | 'other' | string;
  /** A 的昵称 */
  inviterNickname?: string;
  /** A 的头像 */
  inviterAvatar?: string;
  /** A 是否已被别人配对（true 时只允许 B 自己做，跳过伴侣路径） */
  hasExistingPair?: boolean;
  /** 当前用户是否就是 A 本人（自邀请，只允许自己做测试） */
  isSelf?: boolean;
}

export default function JoinPage() {
  const router = useRouter();
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    loadJoinInfo();
  });

  const loadJoinInfo = async () => {
    const { inviterTestSessionId } = router.params;
    if (!inviterTestSessionId) {
      Taro.showToast({ title: '参数缺失', icon: 'none' });
      setLoading(false);
      return;
    }
    try {
      const res = await http.get<JoinInfo>(
        `/api/pair/join/${inviterTestSessionId}`,
      );
      setInfo(res);
    } catch (e) {
      // 拉取失败也要让用户能自己做测试，不阻塞
      Taro.showToast({
        title: (e as Error).message || '邀请信息加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  };

  /** 路径 1：作为 A 的伴侣去做测试 */
  const goAsPartner = () => {
    const { inviterTestSessionId } = router.params;
    Taro.redirectTo({
      url: `/pages/test/index?inviterTestSessionId=${inviterTestSessionId}`,
    });
  };

  /** 路径 2：不是 A 的伴侣，自己做测试（作为新发起人） */
  const goAsSelf = () => {
    Taro.redirectTo({ url: '/pages/test/index' });
  };

  if (loading) {
    return (
      <View className='join loading'>
        <Text className='text-muted'>加载中...</Text>
      </View>
    );
  }

  const inviterName = info?.inviterNickname || 'TA';
  const avatarUrl =
    info?.inviterAvatar || 'https://via.placeholder.com/120';
  const onlySelfPath =
    info?.hasExistingPair === true || info?.isSelf === true;

  return (
    <View className='join'>
      {/* 顶部：A 的邀请信息 */}
      <View className='card inviter-card'>
        <Image className='inviter-avatar' src={avatarUrl} mode='aspectFill' />
        <View className='inviter-meta'>
          <Text className='inviter-name'>{inviterName}</Text>
          <Text className='inviter-tip text-muted'>邀请你做情侣测试</Text>
        </View>
      </View>

      {/* 路径选择 */}
      {!onlySelfPath && (
        <View className='card path-card'>
          <View className='path-head'>
            <Text className='path-title'>你是 TA 的伴侣吗？</Text>
            <Text className='path-desc text-muted'>
              选「我是」会进入配对测试，结果会和 TA 一起解锁
            </Text>
          </View>
          <Button className='btn-primary' onClick={goAsPartner}>
            我是 TA 的伴侣
          </Button>
          <Button className='btn-ghost mt' onClick={goAsSelf}>
            我不是，我自己做
          </Button>
        </View>
      )}

      {/* A 已被配对，只显示自己做 */}
      {onlySelfPath && (
        <View className='card path-card'>
          <View className='path-head'>
            <Text className='path-title'>TA 已经和别人配对了</Text>
            <Text className='path-desc text-muted'>
              不过你还是可以自己来做测试，邀请你的 TA 一起解锁关系类型
            </Text>
          </View>
          <Button className='btn-primary' onClick={goAsSelf}>
            我自己做测试
          </Button>
        </View>
      )}

      <View className='footer'>
        <Text className='text-muted'>问心 AI · 让爱被看见</Text>
      </View>
    </View>
  );
}
