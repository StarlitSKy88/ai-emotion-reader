import { useState, useRef } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh, useShareAppMessage } from '@tarojs/taro';
import { http } from '@/lib/request';
import { isLoggedIn } from '@/lib/auth';
import { trackPageView } from '@/lib/track';
import Icon from '@/components/Icon';
import type { DailyTaskInfo } from '@shared/types';
import './index.scss';

/** GET /api/pair/mine 返回结构 */
interface PairSummary {
  pairSessionId: string;
  coupleTypeName?: string;
  coupleTypeEmoji?: string;
  compatibility?: number;
  partnerNickname?: string;
  /** pending / completed / expired */
  status: string;
  /** B 是否已分享结果给 A */
  resultSharedToInitiator?: boolean;
  /** 是否已付费解锁深度内容 */
  unlocked?: boolean;
}

/**
 * 判断是否为「无数据」类错误（404）。
 * request.ts 抛出的 Error 仅携带 message（无 status code），
 * 故此处匹配后端已知的 404 文案；命中则视为正常无数据，不触发重试，
 * 其它错误（网络/5xx）视为真实失败。
 */
const isNoDataError = (e: unknown): boolean => {
  const msg = (e as Error)?.message || '';
  return (
    msg.includes('404') ||
    msg.includes('暂无配对记录') ||
    msg.includes('尚未配对')
  );
};

export default function Index() {
  const [pair, setPair] = useState<PairSummary | null>(null);
  const [todayTask, setTodayTask] = useState<DailyTaskInfo | null>(null);
  const [loading, setLoading] = useState(true);       // 首次加载中（含重试），用于避免内容闪烁
  const [loadError, setLoadError] = useState(false);  // 首次加载真实失败，展示重试按钮
  // 是否已完成首次加载（区分首次全屏 loading 与后续静默刷新）
  const firstLoadDone = useRef(false);
  // 是否曾经成功加载过（含 404 这种正常无数据），用于失败时决定「重试按钮」还是「toast」
  const everLoadedRef = useRef(false);

  // 分享测试题（不是分享结果）
  useShareAppMessage(() => ({
    title: '我们来做一道情侣测试吧，看看你们的匹配度',
    path: '/pages/index/index',
    imageUrl: '/assets/share/test-share.png',
  }));

  useDidShow(() => {
    trackPageView('pages/index/index');
    loadAll();
  });

  // 下拉刷新（需在 index.config.ts 中开启 enablePullDownRefresh: true 才会触发）
  usePullDownRefresh(() => {
    loadAll(true);
  });

  /** 并行拉取首页所需数据；isRefresh=true 表示由下拉刷新触发 */
  const loadAll = async (isRefresh = false) => {
    // 未登录：无需请求，直接展示默认（未配对）状态
    if (!isLoggedIn()) {
      setPair(null);
      setTodayTask(null);
      setLoadError(false);
      setLoading(false);
      firstLoadDone.current = true;
      everLoadedRef.current = true;
      Taro.stopPullDownRefresh();
      return;
    }

    // 首次加载（含重试）显示全屏 loading；下拉刷新显示刷新态；后续 useDidShow 静默刷新
    const showOverlay = !firstLoadDone.current || isRefresh;
    if (showOverlay) {
      Taro.showLoading({
        title: isRefresh ? '刷新中...' : '加载中...',
        mask: !isRefresh,
      });
    }

    let hasRealError = false;

    const [pairRes, taskRes] = await Promise.allSettled([
      http.get<PairSummary>('/api/pair/mine'),
      http.get<DailyTaskInfo>('/api/task/today'),
    ]);

    // pair：成功→更新；404→置空（未配对，正常状态）；其它错误→标记真实失败（刷新时保留旧值）
    if (pairRes.status === 'fulfilled') {
      setPair(pairRes.value);
    } else if (isNoDataError(pairRes.reason)) {
      setPair(null);
    } else {
      hasRealError = true;
    }

    // task：同上
    if (taskRes.status === 'fulfilled') {
      setTodayTask(taskRes.value);
    } else if (isNoDataError(taskRes.reason)) {
      setTodayTask(null);
    } else {
      hasRealError = true;
    }

    if (showOverlay) {
      Taro.hideLoading();
    }

    if (hasRealError && !everLoadedRef.current) {
      // 从未成功加载过：展示重试按钮
      setLoadError(true);
      setLoading(false);
    } else if (hasRealError) {
      // 已有数据，刷新失败：仅提示，保留现有内容
      Taro.showToast({ icon: 'none', title: '加载失败，请稍后重试' });
    } else {
      // 成功（含 404 正常无数据）
      everLoadedRef.current = true;
      setLoadError(false);
      setLoading(false);
    }

    firstLoadDone.current = true;
    Taro.stopPullDownRefresh();
  };

  /** 重试：重置为首次加载态后再拉一次 */
  const retry = () => {
    setLoadError(false);
    setLoading(true);
    firstLoadDone.current = false;
    loadAll();
  };

  /** 开始测试 */
  const startTest = () => {
    Taro.navigateTo({ url: '/pages/test/index' });
  };

  /** 查看进度（已配对，跳结果页让结果页处理 unlocked/paid 细分状态） */
  const viewProgress = () => {
    if (!pair) return;
    Taro.navigateTo({
      url: `/pages/result/index?pairSessionId=${pair.pairSessionId}`,
    });
  };

  /** 查看类型百科 */
  const viewEncyclopedia = () => {
    Taro.navigateTo({ url: '/pages/type/encyclopedia' });
  };

  /** 跳任务详情 */
  const goTaskDetail = () => {
    if (!todayTask) return;
    Taro.navigateTo({ url: `/pages/task/detail?taskId=${todayTask.id}` });
  };

  return (
    <View className='home'>
      {/* Hero 区 */}
      <View className='hero'>
        <View className='hero-bg' />
        <View className='hero-noise' />
        <View className='hero-content'>
          <Text className='hero-eyebrow'>情感关系 · 深度测试</Text>
          <Text className='hero-title'>问心</Text>
          <Text className='hero-subtitle'>
            两个人，三十题，<Text className='serif'>看见</Text>你们的关系
          </Text>
        </View>
      </View>

      {/* 首次加载失败：重试入口 */}
      {loadError && (
        <View className='card hero-card'>
          <Text className='card-title'>加载失败</Text>
          <Text className='card-desc text-muted'>
            网络不太稳定，请稍后重试
          </Text>
          <Button className='btn-primary' onClick={retry}>重新加载</Button>
        </View>
      )}

      {/* 核心钩子：开始测试（未配对且加载完成时显示） */}
      {!loading && !loadError && !pair && (
        <View className='card hero-card'>
          <Text className='card-eyebrow'>开始</Text>
          <Text className='card-title'>3 分钟情侣匹配测试</Text>
          <Text className='card-desc'>
            男女各 30 题 · 6 维度心理学评估 · 65 种类型结果
          </Text>
          <Button className='btn-primary' onClick={startTest}>开始测试</Button>
        </View>
      )}

      {/* 已配对：状态卡片（无论 pending/completed 都跳结果页查看具体进度） */}
      {!loading && !loadError && pair && (
        <View className='card hero-card status-card'>
          <Text className='card-eyebrow'>进度</Text>
          <Text className='card-title'>
            {pair.status === 'completed'
              ? pair.resultSharedToInitiator
                ? '你们的结果出来了'
                : 'TA 答完了，等 TA 分享'
              : '等待 TA 来测试'}
          </Text>
          <Text className='card-desc text-muted'>
            {pair.status === 'completed'
              ? pair.resultSharedToInitiator
                ? '点击查看你们的关系类型和默契度'
                : '等 TA 主动分享后，基础关系类型会自动解锁'
              : '已发出邀请，等 TA 也来答题后才能解锁结果'}
          </Text>
          <Button className='btn-primary' onClick={viewProgress}>
            查看进度
          </Button>
        </View>
      )}

      {/* 今日任务卡片（已配对且解锁后显示） */}
      {!loading && !loadError && todayTask && (
        <View className='card task-card' onClick={goTaskDetail}>
          <View className='task-card-header'>
            <Text className='task-card-label'>今日任务</Text>
            <Text className='task-card-time'>约 {todayTask.estimatedMin} 分钟</Text>
          </View>
          <Text className='task-card-title'>{todayTask.title}</Text>
          <View className='task-card-status'>
            <View className={`status-item ${todayTask.myStatus === 'done' ? 'done' : ''}`}>
              <Text>我</Text>
              <Icon name={todayTask.myStatus === 'done' ? 'check' : 'circle'} size={28} color={todayTask.myStatus === 'done' ? '#DEDBC8' : '#737373'} />
            </View>
            <View className={`status-item ${todayTask.partnerStatus === 'done' ? 'done' : ''}`}>
              <Text>TA</Text>
              <Icon name={todayTask.partnerStatus === 'done' ? 'check' : 'circle'} size={28} color={todayTask.partnerStatus === 'done' ? '#DEDBC8' : '#737373'} />
            </View>
            <Text className='card-link'>去做 <Icon name='arrow-right' size={24} color='#DEDBC8' /></Text>
          </View>
        </View>
      )}

      {/* 类型百科入口 */}
      <View className='card type-encyclopedia-card' onClick={viewEncyclopedia}>
        <Text className='card-eyebrow'>探索</Text>
        <Text className='card-title'>35 种情侣类型</Text>
        <Text className='card-desc text-muted'>
          烟火余生型 · 双子星型 · 灯塔与舟型 · ...
        </Text>
        <Text className='card-link'>查看类型百科 <Icon name='arrow-right' size={24} color='#DEDBC8' /></Text>
      </View>

      <View className='footer'>
        <Text>问心 AI · 让爱被看见</Text>
        <Text className='footer-meta'>2026 · 内测中</Text>
      </View>
    </View>
  );
}
