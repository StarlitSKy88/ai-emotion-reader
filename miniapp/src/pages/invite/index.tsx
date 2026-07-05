/**
 * 邀请页（A 答完测试后的等待枢纽，纯 A 视角）
 *
 * 状态：
 * 1. pending（B 未答）—— 显示邀请卡片 + 等待状态
 * 2. completed（B 已答但未分享）—— 显示「TA 已答完，等 TA 把结果发给你」（W-WC-2：原「去分享解锁」违反微信运营规范，改为温和措辞）
 * 3. unlocked（B 已分享，A 可看结果）—— 跳转 result 页
 *
 * B 扫码不再经过此页：B 扫码先进路径选择页 /pages/invite/join（带 inviterTestSessionId），
 * 选择「我是 TA 的伴侣」后才进 test 页答完进 result 页
 */
import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage, useRouter } from '@tarojs/taro';
import { http } from '@/lib/request';
import './index.scss';

interface PairInfo {
  pairSessionId: string;
  /** 后端 PairStatus：pending / completed / expired（shared/types.ts） */
  status: string;
  /** A 是否是当前用户 */
  isInitiator: boolean;
  /** 对方昵称 */
  partnerNickname?: string;
  /** 对方头像 */
  partnerAvatar?: string;
  /** 默契度（B 分享后才有） */
  compatibility?: number;
  /** B 是否已分享，结果是否已解锁（独立于 status，避免与 shared PairStatus 枚举冲突） */
  unlocked?: boolean;
}

export default function InvitePage() {
  const router = useRouter();
  const [pair, setPair] = useState<PairInfo | null>(null);
  const [loading, setLoading] = useState(true);
  /** A 自己的性别，分享时带上，供 B 端做同性代词替换 */
  const [inviterGender, setInviterGender] = useState<string | null>(null);

  useShareAppMessage(() => {
    // A 视角分享：B 点击进入路径选择页（带 inviterTestSessionId 和 inviterGender），由 B 自行决定是否作为 A 的伴侣
    const testSessionId = router.params.testSessionId || '';
    const genderParam = inviterGender ? `&inviterGender=${inviterGender}` : '';
    return {
      title: '我们来做一道情侣测试吧，看看你们的匹配度',
      path: `/pages/invite/join?inviterTestSessionId=${testSessionId}${genderParam}`,
      imageUrl: '/assets/share/test-share.png',
    };
  });

  useDidShow(() => {
    loadPairInfo();
    // W-2：inviterGender 取自 A 自己的 TestSession.gender，
    // 与后端 getGenderCombo 用的 TestSession.gender 保持一致（而非 User.gender）
    loadInviterGender();
  });

  /** 拉取 A 自己的 TestSession.gender，供分享 URL 使用 */
  const loadInviterGender = async () => {
    const { testSessionId } = router.params;
    if (!testSessionId) return;
    try {
      const session = await http.get<{ gender: string }>(
        `/api/test/session/${testSessionId}`,
      );
      if (session?.gender) setInviterGender(session.gender);
    } catch {
      // 拉取失败时降级：不带 inviterGender 参数，B 端按默认处理
    }
  };

  const loadPairInfo = async () => {
    const { testSessionId } = router.params;
    if (!testSessionId) {
      Taro.showToast({ title: '参数缺失', icon: 'none' });
      setLoading(false);
      return;
    }
    try {
      const info = await http.get<PairInfo>(
        `/api/pair/status?testSessionId=${testSessionId}`
      );
      setPair(info);
      // B 已分享（unlocked=true），A 自动跳结果页
      if (info.unlocked === true && info.isInitiator) {
        Taro.redirectTo({
          url: `/pages/result/index?pairSessionId=${info.pairSessionId}`,
        });
        return;
      }
    } catch {
      // 还没有 pair 记录，正常等待 B
    } finally {
      setLoading(false);
    }
  };

  /** 复制邀请文案 */
  const copyInviteLink = () => {
    Taro.setClipboardData({
      data: '来测测我们的情侣匹配度：扫码或点击进入问心 AI',
    });
  };

  if (loading) {
    return (
      <View className='invite loading'>
        <Text className='text-muted'>加载中...</Text>
      </View>
    );
  }

  /* A 等待场景 */
  return (
    <View className='invite'>
      <View className='card status-card'>
        <Text className='card-title'>等待 TA 来测试</Text>
        <Text className='card-desc text-muted'>
          {pair?.status === 'completed'
            // W-WC-2 修复：原「TA 已答完，去分享解锁你们的关系类型」违反微信运营规范，改为温和措辞
            ? 'TA 已答完，等 TA 把结果发给你就能看到你们的关系类型'
            : '把邀请分享给 TA，等 TA 也答完才能看到你们的关系类型'}
        </Text>
        {pair?.status === 'pending' && (
          <>
            <Button className='btn-primary' openType='share'>
              分享给微信好友
            </Button>
            <Button className='btn-ghost mt' onClick={copyInviteLink}>
              复制邀请文案
            </Button>
          </>
        )}
        {pair?.status === 'completed' && (
          <Button
            className='btn-primary'
            onClick={() =>
              Taro.redirectTo({
                url: `/pages/result/index?pairSessionId=${pair.pairSessionId}`,
              })
            }
          >
            去看结果
          </Button>
        )}
      </View>

      <View className='card'>
        <Text className='card-title'>关于配对</Text>
        <Text className='card-desc text-muted'>
          - 你和 TA 各自答 30 题，互相看不到对方答案
          {'\n'}- TA 答完后主动分享，你才能看到结果
          {'\n'}- 结果匹配 65 种情侣类型中的一种
        </Text>
      </View>
    </View>
  );
}
