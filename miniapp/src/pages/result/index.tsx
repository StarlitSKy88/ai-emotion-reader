/**
 * 结果页 · V3 商业化
 *
 * 两层付费墙:
 * - basic:类型 + 得分 + 1 天报告(默认 locked,看广告/订阅解锁)
 * - deep:多维度分析 + 30 天报告(basic 解锁后才可见,看广告/订阅解锁)
 *
 * 状态:
 * - !resultSharedToInitiator:B 未分享 → A 等待 / B 引导分享(原逻辑保留)
 * - basicUnlocked=false:显示「看广告解锁结果」CTA,内容模糊
 * - basicUnlocked=true && deepUnlocked=false:显示基础内容,深度内容模糊 + 「看广告解锁深度分析」CTA
 * - deepUnlocked=true:显示全部内容(含 multiDimAnalysis)
 * - isSubscribed=true:跳过所有 CTA,直接显示全部内容,顶部展示 SubscriptionBadge
 *
 * 分享按钮:仅靠 Button openType='share' 触发,useShareAppMessage 根据 B 视角动态返回 result 页分享
 */
import { useState, useRef } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage, useRouter } from '@tarojs/taro';
import { http } from '@/lib/request';
import RadarChart from '@/components/RadarChart';
import ShareCanvas, { type ShareCanvasHandle } from '@/components/ShareCanvas';
import SubscriptionBadge from '@/components/SubscriptionBadge';
import { pickShareVariant } from '@shared/share-variants';
import { buildSharePathWithUtm, parseUtmFromQuery, type UtmParams } from '@/lib/utm';
import { unlockContent, isAdEnabled, type UnlockTier } from '@/lib/ad';
import './index.scss';

/** V3 多维度分析(deep 解锁后由 LLM 生成) */
interface MultiDimAnalysis {
  overview: string;
  dimensions: Array<{ code: string; name: string; analysis: string }>;
  suggestions: string[];
}

interface ResultData {
  pairSessionId: string;
  isInitiator: boolean;
  /** B 是否已分享(基础结果可见的前提) */
  unlocked: boolean;
  /** 是否已付费解锁深度内容(V2 旧字段,V3 中恒为 true,实际以 deepUnlocked 为准) */
  paid: boolean;
  /** V3:basic 是否已解锁(后端如未返回则回退到 unlocked) */
  basicUnlocked?: boolean;
  /** V3:deep 是否已解锁(后端如未返回则回退到 !!multiDimAnalysis) */
  deepUnlocked?: boolean;
  /** V3 多维度分析 */
  multiDimAnalysis?: MultiDimAnalysis;
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
    estimatedRatio?: number;
  };
  alternatives?: Array<{
    code: string;
    name: string;
    emoji: string;
    oneLiner: string;
  }>;
  summary?: string;
  dimensionsA?: Record<string, number>;
  dimensionsB?: Record<string, number>;
  genderCombo?: string;
  myNickname?: string;
  myAvatar?: string;
  partnerNickname?: string;
  partnerAvatar?: string;
}

/** 订阅状态(只取 active 字段) */
interface SubscriptionStatus {
  active: boolean;
}

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<ResultData | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<UnlockTier | null>(null);
  // 朋友圈分享 Canvas 弹窗
  const [showShareCanvas, setShowShareCanvas] = useState(false);
  const shareCanvasRef = useRef<ShareCanvasHandle>(null);
  // utm 上报标记:防止 useDidShow 重复触发时重复上报
  const trackedRef = useRef(false);

  useShareAppMessage(() => {
    const pairSessionId = router.params.pairSessionId || '';
    const isSameSex =
      data?.genderCombo === 'male-male' ||
      data?.genderCombo === 'female-female';
    const basePath = `/pages/result/index?pairSessionId=${pairSessionId}`;

    // B 视角:分享给 A 解锁其视图(用神秘款,不在卡片暴露结果)
    if (data && !data.isInitiator) {
      const utm: UtmParams = {
        utmSource: 'share_card',
        utmMedium: 'miniapp',
        utmCampaign: 'result_share',
        variant: 'mystery',
      };
      return {
        title: '我们做完情侣测试了,来看看你们的关系类型',
        path: buildSharePathWithUtm(basePath, utm),
        imageUrl: '/assets/share/result-share.png',
      };
    }

    // A 视角:分享结果到朋友圈引流,按解锁状态选变体
    if (data?.unlocked && data.matched) {
      const variantResult = pickShareVariant({
        rarity: data.matched.rarity,
        compatibility: data.compatibility,
        stage: undefined,
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

    // 默认:未 unlocked 或无数据,用神秘款
    const utm: UtmParams = {
      utmSource: 'share_card',
      utmMedium: 'miniapp',
      utmCampaign: 'result_share',
      variant: 'mystery',
    };
    return {
      title: '我们做完情侣测试了,来看看结果',
      path: buildSharePathWithUtm(basePath, utm),
      imageUrl: '/assets/share/result-share.png',
    };
  });

  useDidShow(() => {
    loadResult();
    loadSubscriptionStatus();
    if (!trackedRef.current) {
      trackedRef.current = true;
      const utm = parseUtmFromQuery(router.params);
      if (utm.utmSource !== 'unknown') {
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
            // 上报失败不影响页面加载,静默处理
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
        `/api/pair/result?pairSessionId=${pairSessionId}`,
      );
      setData(res);
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptionStatus = async () => {
    try {
      const res = await http.get<SubscriptionStatus>('/api/subscription/status');
      setIsSubscribed(!!res?.active);
    } catch {
      // 静默:订阅状态查询失败不影响结果页主流程
      setIsSubscribed(false);
    }
  };

  /** 派生:basic 是否已解锁 */
  const basicUnlocked = (() => {
    if (!data) return false;
    if (data.basicUnlocked !== undefined) return data.basicUnlocked;
    // 回退:已分享即视为 basic 解锁(stage1 免费策略)
    return data.unlocked;
  })();

  /** 派生:deep 是否已解锁 */
  const deepUnlocked = (() => {
    if (!data) return false;
    if (data.deepUnlocked !== undefined) return data.deepUnlocked;
    // 回退:有 multiDimAnalysis 视为 deep 已解锁
    return !!data.multiDimAnalysis;
  })();

  /**
   * 处理解锁 CTA 点击
   * - 已订阅:不应该出现 CTA(防御性直接 reload)
   * - 阶段1:直接调 unlock API(method=free)
   * - 阶段2/3:先看广告,看完后调 unlock API(method=ad)
   */
  const handleUnlock = async (tier: UnlockTier) => {
    if (!data?.pairSessionId || unlocking) return;
    if (isSubscribed) {
      // 已订阅不应出现 CTA,防御性刷新
      await loadResult();
      return;
    }
    setUnlocking(tier);
    try {
      const result = await unlockContent(data.pairSessionId, tier);
      if (result.success && result.data) {
        // 后端 unlock API 返回完整 ResultData(同 /api/pair/result),
        // ad.ts 中 UnlockResultData 仅声明字段子集,这里安全转换为页面 ResultData
        setData(result.data as unknown as ResultData);
        Taro.showToast({
          title: tier === 'basic' ? '已解锁结果' : '已解锁深度分析',
          icon: 'success',
        });
      } else if (!result.success && result.method === 'ad') {
        // 用户中途退出广告,toast 已在 ad.ts 内提示
      } else if (!result.success) {
        Taro.showToast({ title: '解锁失败,请重试', icon: 'none' });
      }
    } finally {
      setUnlocking(null);
    }
  };

  /**
   * B 视角:分享给 A,同步通知后端更新 resultSharedToInitiator
   */
  const shareToPartner = async () => {
    try {
      await http.post('/api/pair/share', {
        pairSessionId: router.params.pairSessionId,
      });
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
      await loadResult();
    } catch (e) {
      Taro.showToast({
        title: '分享状态更新失败,请重试或联系客服',
        icon: 'none',
        duration: 3000,
      });
    }
  };

  /**
   * 生成朋友圈分享图片(Canvas 绘制)+ 上报 moments 分享事件
   * 仅 basicUnlocked 后可用
   */
  const shareToMoments = () => {
    if (!basicUnlocked) {
      Taro.showToast({ title: '请先解锁结果', icon: 'none' });
      return;
    }
    setShowShareCanvas(true);
    if (!data?.matched) return;
    const isSameSex =
      data.genderCombo === 'male-male' ||
      data.genderCombo === 'female-female';
    const variant = pickShareVariant({
      rarity: data.matched.rarity,
      compatibility: data.compatibility,
      stage: undefined,
      typeName: data.matched.name,
      isSameSex,
      estimatedRatio: data.matched.estimatedRatio,
    }).variant;
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

  const getMomentsCopy = (): string => {
    if (!data?.matched) return '我们做了情侣测试,来看看你们的关系类型';
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

  // B 视角 + !unlocked:B 自己还没分享,引导分享给 A
  if (!data.isInitiator && !data.unlocked) {
    return (
      <View className='result'>
        <View className='card share-card'>
          <Text className='card-title'>分享给 TA 一起看</Text>
          <Text className='card-desc text-muted'>
            你答完了测试,TA 还看不到结果。分享给 TA 一起看吧。
          </Text>
          <Button className='btn-primary' openType='share' onClick={shareToPartner}>
            分享给 TA
          </Button>
        </View>
      </View>
    );
  }

  // A 视角 + !unlocked:B 还没分享,A 等待
  if (data.isInitiator && !data.unlocked) {
    return (
      <View className='result'>
        <View className='card status-card'>
          <Text className='card-title'>等 TA 把结果发给你</Text>
          <Text className='card-desc text-muted'>
            TA 还没把结果发给你。等 TA 主动分享后,你们的基础关系类型(默契度 + 类型 + 一句话)就能看到啦。
          </Text>
        </View>
      </View>
    );
  }

  // 已分享(unlocked=true),进入 V3 两层付费墙流程
  // 已订阅用户:basic + deep 全部可见,跳过 CTA
  const showBasic = isSubscribed || basicUnlocked;
  const showDeep = isSubscribed || deepUnlocked;
  const adEnabled = isAdEnabled();
  const basicCtaText = adEnabled ? '看广告解锁结果' : '解锁结果';
  const deepCtaText = adEnabled ? '看广告解锁深度分析' : '解锁深度分析';

  // 雷达图分数:优先用双方实际维度分,A 缺失时回退到类型典型特征
  const radarScoresA = data.dimensionsA || data.matched.radarProfile;
  const radarScoresB = data.dimensionsB;
  const isDualRadar = !!radarScoresA && !!radarScoresB;

  // 双方头像区域
  const showCoupleAvatar =
    !!data.myNickname ||
    !!data.myAvatar ||
    !!data.partnerNickname ||
    !!data.partnerAvatar;

  return (
    <View className='result'>
      {/* 订阅徽章(已订阅时显示) */}
      <View className='badge-row'>
        <SubscriptionBadge isSubscribed={isSubscribed} />
      </View>

      {/* 默契度(basic 锁定时模糊) */}
      <View className={`card compat-card ${showBasic ? '' : 'locked'}`}>
        <View className='compat-content'>
          <Text className='compat-label'>你们的默契度</Text>
          <Text className='compat-score'>{showBasic ? data.compatibility : '??'}</Text>
          <Text className='compat-unit'>/ 100</Text>
        </View>
        {!showBasic && (
          <View className='lock-overlay'>
            <Text className='lock-hint'>看广告解锁类型 + 得分</Text>
            <Button
              className='btn-primary lock-cta'
              loading={unlocking === 'basic'}
              disabled={unlocking !== null}
              onClick={() => handleUnlock('basic')}
            >
              {basicCtaText}
            </Button>
          </View>
        )}
      </View>

      {/* 双方头像 + 昵称 */}
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

      {/* 类型卡(basic 锁定时整体模糊) */}
      <View className={`card type-card ${data.matched.rarity === 'rare' ? 'rare' : ''} ${showBasic ? '' : 'locked'}`}>
        <View className='type-content'>
          <Text className='type-emoji'>{showBasic ? data.matched.emoji : '🔒'}</Text>
          <Text className='type-name'>{showBasic ? data.matched.name : '???'}</Text>
          <Text className='type-rarity'>
            {showBasic
              ? (data.matched.rarity === 'rare' ? '稀有类型' : '常见类型')
              : '未解锁'}
          </Text>
          {showBasic &&
            (data.genderCombo === 'male-male' ||
              data.genderCombo === 'female-female') && (
              <Text className='type-exclusive'>专属类型</Text>
            )}
          <Text className='type-oneliner'>
            {showBasic ? data.matched.oneLiner : '解锁后查看你们的关系类型与一句话描述'}
          </Text>

          {/* 完整深度内容(deep 解锁后显示) */}
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

        {/* basic 锁定:覆盖整个 type-card */}
        {!showBasic && (
          <View className='lock-overlay'>
            <Text className='lock-hint'>类型 + 默契度 + 1 天报告</Text>
            <Button
              className='btn-primary lock-cta'
              loading={unlocking === 'basic'}
              disabled={unlocking !== null}
              onClick={() => handleUnlock('basic')}
            >
              {basicCtaText}
            </Button>
          </View>
        )}

        {/* deep 锁定:仅覆盖深度内容区 */}
        {showBasic && !showDeep && (
          <View className='lock-overlay deep-lock'>
            <Text className='lock-hint'>多维度分析 + 30 天报告</Text>
            <Button
              className='btn-primary lock-cta'
              loading={unlocking === 'deep'}
              disabled={unlocking !== null}
              onClick={() => handleUnlock('deep')}
            >
              {deepCtaText}
            </Button>
          </View>
        )}
      </View>

      {/* V3 多维度分析(deep 解锁后显示) */}
      {showDeep && data.multiDimAnalysis && (
        <View className='card multi-dim-card'>
          <Text className='section-title'>多维度深度分析</Text>
          <View className='multi-dim-overview'>
            <Text className='multi-dim-label'>总览</Text>
            <Text className='multi-dim-text'>{data.multiDimAnalysis.overview}</Text>
          </View>
          {data.multiDimAnalysis.dimensions.length > 0 && (
            <View className='multi-dim-dims'>
              <Text className='multi-dim-label'>维度解读</Text>
              {data.multiDimAnalysis.dimensions.map((dim) => (
                <View key={dim.code} className='multi-dim-dim'>
                  <Text className='dim-name'>{dim.name}</Text>
                  <Text className='dim-analysis'>{dim.analysis}</Text>
                </View>
              ))}
            </View>
          )}
          {data.multiDimAnalysis.suggestions.length > 0 && (
            <View className='multi-dim-suggestions'>
              <Text className='multi-dim-label'>行动建议</Text>
              {data.multiDimAnalysis.suggestions.map((s, i) => (
                <Text key={i} className='suggestion-item'>· {s}</Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 维度雷达图(basic 解锁后显示) */}
      {showBasic && radarScoresA && (
        <View className='card radar-card'>
          <Text className='section-title'>
            {isDualRadar ? '我们的维度对比' : '维度雷达图'}
          </Text>
          <RadarChart scoresA={radarScoresA} scoresB={isDualRadar ? radarScoresB : undefined} />
          {isDualRadar && (
            <View className='radar-legend-extra'>
              <Text className='legend-extra-text'>
                <Text className='legend-pink'>粉色</Text>是我,<Text className='legend-blue'>蓝色</Text>是 TA
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 备选类型(deep 解锁后显示) */}
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

      {/* 分享到朋友圈(basic 解锁后显示) */}
      {showBasic && data.matched && (
        <View className='card share-moments-card'>
          <Text className='card-title'>分享到朋友圈</Text>
          <Text className='card-desc text-muted'>
            生成专属情侣类型卡片,保存到相册后可发朋友圈
          </Text>
          <Button className='btn-primary' onClick={shareToMoments}>
            生成分享图片
          </Button>
        </View>
      )}

      {/* 任务入口(basic 解锁后显示) */}
      {showBasic && (
        <View className='card'>
          <Text className='card-title'>继续关系成长</Text>
          <Text className='card-desc text-muted'>
            基于你们的关系类型,每日推送一个 3 分钟微行动
          </Text>
          <Button
            className='btn-ghost'
            onClick={() => Taro.switchTab({ url: '/pages/tasks/index' })}
          >
            查看每日任务
          </Button>
        </View>
      )}

      {/* 朋友圈分享 Canvas 弹窗(basic 解锁后可用) */}
      {showBasic && data.matched && (
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
