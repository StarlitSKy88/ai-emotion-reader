/**
 * 站点地图（Phase 6.3）
 * https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 *
 * 仅暴露官网落地页，不暴露小程序内页（小程序内容不在 Web 抓取范围）。
 * 旧路由（/auth/signin /chat/[id]）已 301 归档到 /，不收录。
 */
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://wenxin.taomyst.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
