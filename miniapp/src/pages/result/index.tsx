/**
 * 结果页
 *
 * B-WC-1 修复：解锁功能已移除，深度内容免费显示。
 * - A 视角 + !unlocked：显示「等 TA 把结果发给你」（W-WC-2：原「等 TA 分享解锁」违反微信运营规范，改为温和措辞），无默契度数字
 * - A 视角 + unlocked：显示完整结果（默契度+类型+深度内容）
 * - B 视角 + !unlocked：显示「分享给 TA 一起看」（W-WC-2：原「分享给 TA 解锁」违反微信运营规范，改为温和措辞）+ openType=share 按钮，无默契度数字
 * - B 视角 + unlocked：同 A 视角
 *
 * 分享按钮：仅靠 Button openType='share' 触发，useShareAppMessage 根据 B 视角动态返回 result 页分享
 */
import { useState, useRef } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage, useRouter } from '@tarojs/taro';
import { http } from '@/lib/request';
import RadarChart from '@/components/RadarChart';
import ShareCanvas, { type ShareCanvasHandle } from '@/components/ShareCanvas';
import { pickShareVariant } from '@shared/share-variants';
import { buildSharePathWithUtm, parseUtmFromQuery, type UtmParams } from '@/lib/utm';
import './index.scss';

interface ResultData {
  pairSessionId: string;
  isInitiator: boolean; // A 或 B
  /** B 是否已分享（基础结果可见） */
  unlocked: boolean;
  /** 是否已付费解锁深度内容 */
  paid: boolean;
  compatibility: number;
  matched: {
    code: string;
    name: string;
    emoji: string;
    rarity: 'common' | 'rare';
    oneLiner: string;
    description?: string;
    hiddenRisks?: string;
    growthAdvice?: string;
    shareCopy?: string;
    radarProfile?: Record<string, number>;
    /** 类型估计占比（0-1 小数，用于 boast 变体替换 N%） */
    estimatedRatio?: number;
  };
  alternatives?: Array<{
    code: string;
    name: string;
    emoji: string;
    oneLiner: string;
  }>;
  summary?: string;
  /** A 的 6 维度分数（用于雷达图），unlocked 后由后端返回 */
  dimensionsA?: Record<string, number>;
  /** B 的 6 维度分数（用于双方对比雷达图），unlocked 后由后端返回 */
  dimensionsB?: Record<string, number>;
  /** 性别组合 'male-male' / 'male-female' / 'female-female' 等，用于触发同性专属类型标签 */
  genderCombo?: string;
  /** A（自己）的昵称，unlocked 后由后端返回 */
  myNickname?: string;
  /** A（自己）的头像 URL，unlocked 后由后端返回 */
  myAvatar?: string;
  /** B（对方）的昵称，unlocked 后由后端返回 */
  partnerNickname?: string;
  /** B（对方）的头像 URL，unlocked 后由后端返回 */
  partnerAvatar?: string;
}

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  // 朋友圈分享 Canvas 弹窗
  const [showShareCanvas, setShowShareCanvas] = useState(false);
  const shareCanvasRef = useRef<ShareCanvasHandle>(null);
  // utm 上报标记：防止 useDidShow 重复触发时重复上报
  const trackedRef = useRef(false);

  useShareAppMessage(() => {
    const pairSessionId = router.params.pairSessionId || '';
    // 同性隐私保护：male-male / female-female 不在分享卡片中暴露类型名（3.4.4）
    const isSameSex =
      data?.genderCombo === 'male-male' ||
      data?.genderCombo === 'female-female';
    const basePath = `/pages/result/index?pairSessionId=${pairSessionId}`;

    // B 视角：分享给 A 解锁其视图（用神秘款，不在卡片暴露结果）
    if (data && !data.isInitiator) {
      const utm: UtmParams = {
        utmSource: 'share_card',
        utmMedium: 'miniapp',
        utmCampaign: 'result_share',
        variant: 'mystery',
      };
      return {
        title: '我们做完情侣测试了，来看看你们的关系类型',
        path: buildSharePathWithUtm(basePath, utm),
        imageUrl: '/assets/share/result-share.png',
      };
    }

    // A 视角：分享结果到朋友圈引流，按 unlocked 状态选变体
    if (data?.unlocked && data.matched) {
      const variantResult = pickShareVariant({
        rarity: data.matched.rarity,
        compatibility: data.compatibility,
        stage: undefined, // stage 不在 ResultData 中，后续扩展
        typeName: data.matched.name,
        isSameSex,
        estimatedRatio: data.matched.estimatedRatio,
      });
      const utm: UtmParams = {
        utmSource: 'moments',
        utmMedium: 'miniapp',
        utmCampaign: 'result_share',
        variant: variantResult.variant,
      };
      return {
        title: variantResult.title,
        path: buildSharePathWithUtm(basePath, utm),
        imageUrl: '/assets/share/result-share.png',
      };
    }

    // 默认：未 unlocked 或无数据，用神秘款
    const utm: UtmParams = {
      utmSource: 'share_card',
      utmMedium: 'miniapp',
      utmCampaign: 'result_share',
      variant: 'mystery',
    };
    return {
      title: '我们做完情侣测试了，来看看结果',
      path: buildSharePathWithUtm(basePath, utm),
      imageUrl: '/assets/share/result-share.png',
    };
  });

  useDidShow(() => {
    loadResult();
    // 解析 utm 并上报（仅首次进入页面时上报一次）
    // 用 useRef 标记防止 useDidShow 重复触发时重复上报
    if (!trackedRef.current) {
      trackedRef.current = true;
      const utm = parseUtmFromQuery(router.params);
      if (utm.utmSource !== 'unknown') {
        // 仅当有 utm 参数时上报（普通进入不记录）
        // requireAuth=false：允许从分享卡片进入的未登录用户也上报，避免分享引流追踪链路断裂
        http
          .post(
            '/api/pair/track',
            {
              pairSessionId: router.params.pairSessionId,
              utmSource: utm.utmSource,
              utmMedium: utm.utmMedium,
              utmCampaign: utm.utmCampaign,
              variant: utm.variant,
            },
            false,
          )
          .catch(() => {
            // 上报失败不影响页面加载，静默处理
          });
      }
    }
  });

  const loadResult = async () => {
    const { pairSessionId } = router.params;
    if (!pairSessionId) {
      Taro.showToast({ title: '参数缺失', icon: 'none' });
      setLoading(false);
      return;
    }
    try {
      const res = await http.get<ResultData>(
        `/api/pair/result?pairSessionId=${pairSessionId}`
      );
      setData(res);
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * B 视角：分享给 A，同步通知后端更新 resultSharedToInitiator。
   * 与 Button openType='share' 同时触发：openType 拉起微信分享面板，
   * onClick 负责落库，两者不冲突。失败时仅 toast，不阻塞分享面板。
   *
   * 同时上报 share_card 分享事件（utm_source=share_card），用于计算分享率指标（Phase 3 验证目标 >15%）
   */
  const shareToPartner = async () => {
    try {
      await http.post('/api/pair/share', {
        pairSessionId: router.params.pairSessionId,
      });
      // 上报分享事件（B 分享给 A），失败不影响主流程
      // requireAuth=false：B 已登录，但保持与 useDidShow 一致的匿名兼容写法
      http
        .post(
          '/api/pair/track',
          {
            pairSessionId: router.params.pairSessionId,
            utmSource: 'share_card',
            utmMedium: 'miniapp',
            utmCampaign: 'result_share',
            variant: 'mystery',
          },
          false,
        )
        .catch(() => {});
      // 分享意图已落库（resultSharedToInitiator=true），重新拉取完整 ResultData
      // 不能仅 setData({unlocked:true})，因为 !unlocked 时后端返回的是最小信息（compatibility=0、matched 全空）
      await loadResult();
    } catch (e) {
      Taro.showToast({
        title: '分享状态更新失败，请重试或联系客服',
        icon: 'none',
        duration: 3000,
      });
    }
  };

  /**
   * 生成朋友圈分享图片（Canvas 绘制）+ 上报 moments 分享事件
   * 仅 unlocked=true 时可用（无结果数据无法绘制卡片）
   */
  const shareToMoments = () => {
    if (!data?.unlocked) {
      // W-WC-2 修复：原「请先等 TA 分享解锁结果」违反微信运营规范，改为温和措辞
      Taro.showToast({ title: '请先等 TA 把结果发给你', icon: 'none' });
      return;
    }
    setShowShareCanvas(true);
    // 上报朋友圈分享事件
    const isSameSex =
      data.genderCombo === 'male-male' ||
      data.genderCombo === 'female-female';
    const variant = data.matched
      ? pickShareVariant({
          rarity: data.matched.rarity,
          compatibility: data.compatibility,
          stage: undefined,
          typeName: data.matched.name,
          isSameSex,
          estimatedRatio: data.matched.estimatedRatio,
        }).variant
      : 'mystery';
    http
      .post(
        '/api/pair/track',
        {
          pairSessionId: router.params.pairSessionId,
          utmSource: 'moments',
          utmMedium: 'miniapp',
          utmCampaign: 'result_share',
          variant,
        },
        false,
      )
      .catch(() => {});
  };

  /** 获取朋友圈文案（4 种变体之一） */
  const getMomentsCopy = (): string => {
    if (!data?.matched) return '我们做了情侣测试，来看看你们的关系类型';
    const isSameSex =
      data.genderCombo === 'male-male' ||
      data.genderCombo === 'female-female';
    return pickShareVariant({
      rarity: data.matched.rarity,
      compatibility: data.compatibility,
      stage: undefined,
      typeName: data.matched.name,
      isSameSex,
      estimatedRatio: data.matched.estimatedRatio,
    }).momentsCopy;
  };

  if (loading) {
    return (
      <View className='result loading'>
        <Text className='text-muted'>加载中...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View className='result loading'>
        <Text className='text-muted'>无数据</Text>
      </View>
    );
  }

  // B 视角 + !unlocked：B 自己还没分享，引导分享给 A
  if (!data.isInitiator && !data.unlocked) {
    return (
      <View className='result'>
        <View className='card share-card'>
          {/* W-WC-2 修复：原「分享给 TA 解锁」违反微信运营规范，改为温和措辞 */}
          <Text className='card-title'>分享给 TA 一起看</Text>
          <Text className='card-desc text-muted'>
            你答完了测试，TA 还看不到结果。分享给 TA 一起看吧。
          </Text>
          <Button className='btn-primary' openType='share' onClick={shareToPartner}>
            分享给 TA
          </Button>
        </View>
      </View>
    );
  }

  // A 视角 + !unlocked：B 还没分享，A 等待
  if (data.isInitiator && !data.unlocked) {
    return (
      <View className='result'>
        <View className='card status-card'>
          {/* W-WC-2 修复：原「等 TA 分享解锁」违反微信运营规范，改为温和措辞 */}
          <Text className='card-title'>等 TA 把结果发给你</Text>
          <Text className='card-desc text-muted'>
            TA 还没把结果发给你。等 TA 主动分享后，你们的基础关系类型（默契度 + 类型 + 一句话）就能看到啦。
          </Text>
        </View>
      </View>
    );
  }

  // 后续：unlocked=true（基础结果可见）；B-WC-1 修复后 paid 恒为 true，深度内容免费显示
  const showDeep = data.paid;

  // 雷达图分数：优先用双方实际维度分，A 缺失时回退到类型典型特征
  const radarScoresA = data.dimensionsA || data.matched.radarProfile;
  const radarScoresB = data.dimensionsB;
  // 双方对比模式：unlocked 且 B 数据存在时启用
  const isDualRadar = !!data.unlocked && !!radarScoresA && !!radarScoresB;

  // 双方头像区域：unlocked=true 且后端返回了任一方信息时显示
  const showCoupleAvatar =
    !!data.myNickname ||
    !!data.myAvatar ||
    !!data.partnerNickname ||
    !!data.partnerAvatar;

  return (
    <View className='result'>
      {/* 默契度（B 已分享后才显示） */}
      <View className='card compat-card'>
        <Text className='compat-label'>你们的默契度</Text>
        <Text className='compat-score'>{data.compatibility}</Text>
        <Text className='compat-unit'>/ 100</Text>
      </View>

      {/* 双方头像 + 昵称（默契度卡片下方，unlocked 且后端有数据时显示） */}
      {showCoupleAvatar && (
        <View className='card couple-card'>
          <View className='couple-side'>
            <Image
              className='couple-avatar'
              src={data.myAvatar || 'https://via.placeholder.com/120'}
              mode='aspectFill'
            />
            <Text className='couple-name'>
              {data.myNickname || '我'}
            </Text>
          </View>
          <View className='couple-link'>
            <View className='couple-line' />
            <Text className='couple-heart'>❤</Text>
            <View className='couple-line' />
          </View>
          <View className='couple-side'>
            <Image
              className='couple-avatar'
              src={data.partnerAvatar || 'https://via.placeholder.com/120'}
              mode='aspectFill'
            />
            <Text className='couple-name'>
              {data.partnerNickname || 'TA'}
            </Text>
          </View>
        </View>
      )}

      {/* 类型卡 */}
      <View className={`card type-card ${data.matched.rarity === 'rare' ? 'rare' : ''}`}>
        <Text className='type-emoji'>{data.matched.emoji}</Text>
        <Text className='type-name'>{data.matched.name}</Text>
        <Text className='type-rarity'>
          {data.matched.rarity === 'rare' ? '稀有类型' : '常见类型'}
        </Text>
        {/* 同性专属类型标签：仅在 paid 后显示（避免 unlocked 未付费时截图发朋友圈泄漏同性关系） */}
        {data.paid &&
          (data.genderCombo === 'male-male' ||
            data.genderCombo === 'female-female') && (
            <Text className='type-exclusive'>专属类型</Text>
          )}
        <Text className='type-oneliner'>{data.matched.oneLiner}</Text>

        {/* 完整深度内容（B-WC-1 修复：免费显示） */}
        {showDeep && data.matched.description && (
          <View className='type-detail'>
            <View className='detail-section'>
              <Text className='detail-title'>关系描述</Text>
              <Text className='detail-text'>{data.matched.description}</Text>
            </View>
            <View className='detail-section'>
              <Text className='detail-title'>隐藏风险</Text>
              <Text className='detail-text'>{data.matched.hiddenRisks}</Text>
            </View>
            <View className='detail-section'>
              <Text className='detail-title'>成长建议</Text>
              <Text className='detail-text'>{data.matched.growthAdvice}</Text>
            </View>
            {data.summary && (
              <View className='detail-section'>
                <Text className='detail-title'>AI 关系总结</Text>
                <Text className='detail-text'>{data.summary}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 维度雷达图（unlocked 后显示；有双方分数则对比，否则单方） */}
      {radarScoresA && (
        <View className='card radar-card'>
          <Text className='section-title'>
            {isDualRadar ? '我们的维度对比' : '维度雷达图'}
          </Text>
          <RadarChart scoresA={radarScoresA} scoresB={isDualRadar ? radarScoresB : undefined} />
          {isDualRadar && (
            <View className='radar-legend-extra'>
              <Text className='legend-extra-text'>
                <Text className='legend-pink'>粉色</Text>是我，<Text className='legend-blue'>蓝色</Text>是 TA
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 备选类型（付费后显示） */}
      {showDeep && data.alternatives && data.alternatives.length > 0 && (
        <View className='card'>
          <Text className='section-title'>你们还可能是</Text>
          {data.alternatives.map((alt) => (
            <View key={alt.code} className='alt-item'>
              <Text className='alt-emoji'>{alt.emoji}</Text>
              <View className='alt-info'>
                <Text className='alt-name'>{alt.name}</Text>
                <Text className='alt-desc text-muted'>{alt.oneLiner}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 分享到朋友圈（unlocked 后显示，含 Canvas 绘制） */}
      {data.unlocked && data.matched && (
        <View className='card share-moments-card'>
          <Text className='card-title'>分享到朋友圈</Text>
          <Text className='card-desc text-muted'>
            生成专属情侣类型卡片，保存到相册后可发朋友圈
          </Text>
          <Button className='btn-primary' onClick={shareToMoments}>
            生成分享图片
          </Button>
        </View>
      )}

      {/* 任务入口（付费后显示） */}
      {showDeep && (
        <View className='card'>
          <Text className='card-title'>继续关系成长</Text>
          <Text className='card-desc text-muted'>
            基于你们的关系类型，每日推送一个 3 分钟微行动
          </Text>
          <Button
            className='btn-ghost'
            onClick={() => Taro.switchTab({ url: '/pages/tasks/index' })}
          >
            查看每日任务
          </Button>
        </View>
      )}

      {/* 朋友圈分享 Canvas 弹窗（unlocked 后可用） */}
      {data.unlocked && data.matched && (
        <ShareCanvas
          ref={shareCanvasRef}
          visible={showShareCanvas}
          onClose={() => setShowShareCanvas(false)}
          canvasId='result-share-canvas'
          myAvatar={data.myAvatar}
          partnerAvatar={data.partnerAvatar}
          myNickname={data.myNickname}
          partnerNickname={data.partnerNickname}
          typeEmoji={data.matched.emoji}
          typeName={data.matched.name}
          typeOneLiner={data.matched.oneLiner}
          compatibility={data.compatibility}
          radarScoresA={data.dimensionsA || data.matched.radarProfile}
          radarScoresB={data.dimensionsB}
          isSameSex={
            data.genderCombo === 'male-male' ||
            data.genderCombo === 'female-female'
          }
          momentsCopy={getMomentsCopy()}
        />
      )}
    </View>
  );
}
