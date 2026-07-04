/**
 * 根 Layout（Phase 6.3 强化 SEO）
 *
 * - 完整 metadata（title/description/keywords/openGraph/twitter/alternates）
 * - JSON-LD 结构化数据（SoftwareApplication + Product + WebSite）
 * - lang="zh-CN" + 字体语义化
 */
import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://wenxin.ai';
const SITE_NAME = '问心 AI';
const SITE_DESCRIPTION =
  '基于心理学模型的情侣关系成长工具。每日 3 分钟任务 + 6 维度关系类型 + 7/30 天成长报告。¥39/月 ¥298/年订阅。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '问心 AI · 情侣关系成长工具',
    template: '%s · 问心 AI',
  },
  description: SITE_DESCRIPTION,
  keywords: [
    '情侣关系',
    '关系成长',
    '心理测试',
    '情侣任务',
    '关系类型',
    '默契度',
    '6 维度关系',
    '依恋沟通',
    'AI 关系咨询',
    '每日情侣任务',
  ],
  authors: [{ name: '问心 AI' }],
  creator: '问心 AI',
  publisher: '问心 AI',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE_URL,
    title: '问心 AI · 情侣关系成长工具',
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: '问心 AI · 情侣关系成长工具',
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

/** JSON-LD 结构化数据 */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: 'zh-CN',
  potentialAction: {
    '@type': 'ViewAction',
    target: SITE_URL,
    name: '扫码进入小程序',
  },
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
  },
};

/** JSON-LD 产品结构化数据（订阅） */
const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: '问心 AI 年度订阅',
  description: '情侣关系成长工具订阅，含每日任务 + 关系类型 + 7/30 天成长报告',
  brand: { '@type': 'Brand', name: SITE_NAME },
  offers: [
    {
      '@type': 'Offer',
      price: '39',
      priceCurrency: 'CNY',
      description: '月度订阅',
      availability: 'https://schema.org/InStock',
    },
    {
      '@type': 'Offer',
      price: '298',
      priceCurrency: 'CNY',
      description: '年度订阅（省 ¥170）',
      availability: 'https://schema.org/InStock',
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='zh-CN'>
      <head>
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
