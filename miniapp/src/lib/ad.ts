/**
 * @deprecated B-WC-1 修复：广告解锁功能已移除，V2 接入虚拟支付后恢复。
 *
 * 微信激励视频封装
 * - adUnitId 由编译时注入：dev/prod 配置中的 REWARDED_AD_UNIT_ID
 * - 开发环境用微信官方测试 adUnitId 'adunit-xxxxxxxxxxxx'，正式环境替换为流量主后台申请的真实 adUnitId
 *
 * 用法：
 *   showRewardedVideoAd(
 *     () => { /* 拿到奖励 *\/ },
 *     (err) => Taro.showToast({ title: err.message, icon: 'none' }),
 *   );
 */
import Taro from '@tarojs/taro';

/** 测试 adUnitId（微信官方提供，正式发布前需替换） */
const AD_UNIT_ID =
  (typeof REWARDED_AD_UNIT_ID !== 'undefined' ? REWARDED_AD_UNIT_ID : '') ||
  'adunit-xxxxxxxxxxxx';

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

/**
 * 展示激励视频广告，看完后回调 onReward
 * @param onReward 用户完整看完广告触发的奖励回调
 * @param onError 广告加载或播放失败的兜底回调
 */
export function showRewardedVideoAd(
  onReward: () => void,
  onError?: (e: Error) => void,
): void {
  let ad: RewardedVideoAd | null = null;
  try {
    ad = (Taro as unknown as TaroWithAd).createRewardedVideoAd({
      adUnitId: AD_UNIT_ID,
    });
  } catch (e) {
    onError?.(new Error('广告加载失败'));
    return;
  }

  const handleClose = (res: { isEnded: boolean }) => {
    if (res && res.isEnded) {
      onReward();
    } else {
      Taro.showToast({ title: '需看完广告才能解锁', icon: 'none' });
    }
    cleanup();
  };

  const handleError = (err: { errCode: number; errMsg: string }) => {
    onError?.(new Error('广告加载失败'));
    cleanup();
  };

  const cleanup = () => {
    try {
      ad?.offClose?.(handleClose);
      ad?.offError?.(handleError);
    } catch {
      // 旧版本基础库可能没有 off* 方法，忽略清理失败
    }
  };

  ad.onClose(handleClose);
  ad.onError(handleError);

  // show 失败时先 load 再 show，兼容冷启动广告未预加载的场景
  ad.show().catch(() => {
    ad
      ?.load()
      .then(() => ad?.show())
      .catch(() => {
        onError?.(new Error('广告加载失败'));
        cleanup();
      });
  });
}
