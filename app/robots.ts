/**
 * 爬虫协议（Phase 6.3）
 * https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 *
 * 允许爬取官网落地页，禁止爬取 API、auth、chat、admin 等内部路由。
 */
import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://wenxin.ai';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/chat/', '/admin/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
