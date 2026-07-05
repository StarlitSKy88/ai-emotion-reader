/**
 * V3 商业化广告组件
 *
 * 两层解锁:
 * - basic:看 1 次激励视频解锁「类型+得分+1天报告」
 * - deep:看 1 次激励视频解锁「多维度分析+30天报告」
 *
 * 阶段1(isAdEnabled=false / 未配置广告位):不显示广告,直接调用 unlock API(method=free)
 * 阶段2/3(isAdEnabled=true):显示激励视频,看完后调用 unlock API(method=ad)
 *
 * adUnitId 由编译时注入(见 config/dev.ts、config/prod.ts 的 REWARDED_AD_UNIT_ID)。
 * 测试 adUnitId 'adunit-xxxxxxxxxxxx' 为微信官方提供,正式发布前需替换为流量主后台申请的真实 adUnitId。
 */
import Taro from '@tarojs/taro';
import { http } from './request';

/**
 * 编译时注入的激励视频 adUnitId(空字符串表示未配置,等同于阶段1免费)。
 *
 * REWARDED_AD_UNIT_ID 由 config/dev.ts、config/prod.ts 的 defineConstants 注入,
 * 类型声明见 global.d.ts。这里用一个独立常量名避免与全局同名冲突。
 */
const AD_UNIT_ID =
  (typeof REWARDED_AD_UNIT_ID !== 'undefined' ? REWARDED_AD_UNIT_ID : '') || '';

/** V3 解锁层级 */
export type UnlockTier = 'basic' | 'deep';

/** V3 解锁方式(后端落库字段) */
export type UnlockMethod = 'ad' | 'pay' | 'free';

/** 激励视频广告实例的最小接口签名(避免依赖 @tarojs/taro 的可选类型) */
interface RewardedVideoAd {
  show: () => Promise<void>;
  load: () => Promise<void>;
  onClose: (cb: (res: { isEnded: boolean }) => void) => void;
  onError: (cb: (err: { errCode: number; errMsg: string }) => void) => void;
  offClose?: (cb: (res: { isEnded: boolean }) => void) => void;
  offError?: (cb: (err: { errCode: number; errMsg: string }) => void) => void;
}

interface TaroWithAd {
  createRewardedVideoAd: (opts: { adUnitId: string }) => RewardedVideoAd;
}

/** 解锁 API 返回的 ResultData(与 /api/pair/result 一致,字段子集) */
export interface UnlockResultData {
  pairSessionId: string;
  unlocked: boolean;
  paid: boolean;
  /** V3:basic 是否已解锁(后端如未返回则回退到 unlocked) */
  basicUnlocked?: boolean;
  /** V3:deep 是否已解锁(后端如未返回则回退到 paid 或 !!multiDimAnalysis) */
  deepUnlocked?: boolean;
  /** V3 多维度分析(deep 解锁后 LLM 生成) */
  multiDimAnalysis?: {
    overview: string;
    dimensions: Array<{ code: string; name: string; analysis: string }>;
    suggestions: string[];
  };
  [key: string]: unknown;
}

/** 解锁 API 响应 */
export interface UnlockResponse<T = UnlockResultData> {
  success: boolean;
  method: UnlockMethod;
  data?: T;
}

/** 单例激励视频广告实例 */
let rewardedAd: RewardedVideoAd | null = null;

/** 是否启用了广告(阶段2/3 且配置了 adUnitId) */
export function isAdEnabled(): boolean {
  return !!AD_UNIT_ID;
}

/** 获取激励视频广告单例(未配置 adUnitId 返回 null) */
function getRewardedAd(): RewardedVideoAd | null {
  if (!AD_UNIT_ID) return null;
  if (!rewardedAd) {
    rewardedAd = (Taro as unknown as TaroWithAd).createRewardedVideoAd({
      adUnitId: AD_UNIT_ID,
    });
  }
  return rewardedAd;
}

/**
 * 显示激励视频广告,返回是否完整观看
 *
 * - 未配置广告位(阶段1):直接返回 true(免费解锁)
 * - 已配置:show 失败时尝试 load 再 show,看完 isEnded=true 才返回 true
 */
export async function showRewardedAd(): Promise<boolean> {
  const ad = getRewardedAd();
  if (!ad) {
    // 阶段1 或未配置广告位:直接返回 true(免费解锁)
    return true;
  }
  try {
    await ad.show();
  } catch {
    // show 失败(冷启动未预加载),先 load 再 show
    try {
      await ad.load();
      await ad.show();
    } catch (err) {
      console.error('广告加载失败', err);
      return false;
    }
  }
  return new Promise<boolean>((resolve) => {
    const onClose = (res: { isEnded: boolean }) => {
      ad.offClose?.(onClose);
      resolve(!!res?.isEnded);
    };
    ad.onClose(onClose);
  });
}

/**
 * 调用 V3 解锁 API
 *
 * 流程:
 * 1. 阶段1(未配置广告位):直接 POST unlock(method=free)
 * 2. 阶段2/3:先 showRewardedAd,看完后再 POST unlock(method=ad)
 * 3. 用户中途退出广告 → 返回 { success: false, method: 'ad' }
 *
 * @param pairSessionId 配对会话 ID
 * @param tier 解锁层级 'basic' | 'deep'
 * @returns { success, method, data? }
 */
export async function unlockContent(
  pairSessionId: string,
  tier: UnlockTier,
): Promise<UnlockResponse> {
  const adEnabled = isAdEnabled();
  const method: UnlockMethod = adEnabled ? 'ad' : 'free';

  if (adEnabled) {
    const completed = await showRewardedAd();
    if (!completed) {
      Taro.showToast({ title: '需看完广告才能解锁', icon: 'none' });
      return { success: false, method: 'ad' };
    }
  }

  try {
    const data = await http.post<UnlockResultData>('/api/pair/unlock', {
      pairSessionId,
      tier,
      method,
    });
    return { success: true, method, data };
  } catch (err) {
    console.error('解锁 API 调用失败', err);
    return { success: false, method };
  }
}
