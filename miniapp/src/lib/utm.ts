/**
 * 前端 utm 工具（路径构造 + query 解析）
 * 后端落库逻辑在 lib/share-tracking.ts，前端不直接 import
 */
import type { ShareVariant } from '@shared/share-variants';

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

export function parseUtmFromQuery(query: Record<string, string | undefined>): UtmParams {
  return {
    utmSource: query.utm_source || DEFAULT_UTM.utmSource,
    utmMedium: query.utm_medium || DEFAULT_UTM.utmMedium,
    utmCampaign: query.utm_campaign || DEFAULT_UTM.utmCampaign,
    variant: (query.utm_variant as ShareVariant) || DEFAULT_UTM.variant,
  };
}

export function buildSharePathWithUtm(
  basePath: string,
  utm: UtmParams,
): string {
  const sep = basePath.includes('?') ? '&' : '?';
  return `${basePath}${sep}utm_source=${encodeURIComponent(utm.utmSource)}&utm_medium=${encodeURIComponent(utm.utmMedium)}&utm_campaign=${encodeURIComponent(utm.utmCampaign)}&utm_variant=${utm.variant}`;
}
