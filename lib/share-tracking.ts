/**
 * 分享来源追踪（utm 参数解析 + ShareEvent 落库）
 *
 * utm 参数约定：
 * - utm_source: share_card / moments / wechat
 * - utm_medium: miniapp / web
 * - utm_campaign: result_share / type_encyclopedia
 *
 * 落库时机：
 * - B 点击「分享给 TA」按钮：POST /api/pair/share 已落 resultSharedToInitiator=true
 *   → 额外调 POST /api/pair/track 记录 ShareEvent
 * - A/B 点击「分享到朋友圈」：POST /api/pair/track 记录 ShareEvent
 * - 用户从分享卡片进入 result 页：useDidShow 解析 utm → POST /api/pair/track
 */
import { prisma } from '@/lib/prisma';
import type { ShareVariant } from '@/shared/share-variants';

export interface UtmParams {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  variant: ShareVariant;
}

export const DEFAULT_UTM: UtmParams = {
  utmSource: 'unknown',
  utmMedium: 'miniapp',
  utmCampaign: 'result_share',
  variant: 'mystery',
};

/**
 * 从 query 参数解析 utm（用于 result 页 useDidShow）
 * 容错：缺失字段用默认值填充
 */
export function parseUtmFromQuery(query: Record<string, string | undefined>): UtmParams {
  return {
    utmSource: query.utm_source || DEFAULT_UTM.utmSource,
    utmMedium: query.utm_medium || DEFAULT_UTM.utmMedium,
    utmCampaign: query.utm_campaign || DEFAULT_UTM.utmCampaign,
    variant: (query.utm_variant as ShareVariant) || DEFAULT_UTM.variant,
  };
}

/**
 * 构造带 utm 的分享 path
 * 用于 useShareAppMessage 返回的 path
 */
export function buildSharePathWithUtm(
  basePath: string,
  utm: UtmParams,
): string {
  const sep = basePath.includes('?') ? '&' : '?';
  return `${basePath}${sep}utm_source=${encodeURIComponent(utm.utmSource)}&utm_medium=${encodeURIComponent(utm.utmMedium)}&utm_campaign=${encodeURIComponent(utm.utmCampaign)}&utm_variant=${utm.variant}`;
}

/**
 * 落库 ShareEvent（幂等：同一 pairSessionId + utm 组合不重复记录）
 * 实际不强制幂等，因为同一对可能多次分享，每次都算一个事件用于统计分享次数
 */
export async function recordShareEvent(params: {
  pairSessionId: string;
  sharerUserId?: string;
  utm: UtmParams;
}): Promise<void> {
  await prisma.shareEvent.create({
    data: {
      pairSessionId: params.pairSessionId,
      sharerUserId: params.sharerUserId ?? null,
      utmSource: params.utm.utmSource,
      utmMedium: params.utm.utmMedium,
      utmCampaign: params.utm.utmCampaign,
      variant: params.utm.variant,
    },
  });
}
