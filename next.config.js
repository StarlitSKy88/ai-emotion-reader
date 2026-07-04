/**
 * Next.js 配置（Phase 6.5 旧路由归档）
 *
 * 301 重定向规则：
 * - /auth/* → /（旧 NextAuth 登录流程已废弃，改用微信小程序登录）
 * - /chat/* → /（旧 chat 流程已废弃，改用小程序 task/chat）
 * - /api/summary, /api/analyze → /（旧单次报告 API 已废弃）
 * - /api/sessions/* → /（旧 sessions API 已废弃）
 *
 * 注：重定向到 / 而非 404，避免外链失效产生死链（影响 SEO）
 *
 * V2 优化（W-8）：配置审查结论
 * 已审查 Next.js 14.2 常见配置项，本项目均不需要，原因如下：
 *   - images.domains / images.remotePatterns：项目未使用 next/image 加载远程图片
 *     （图片上传走自有 /api/upload，结果回写 mediaUrls；落地页/小程序均用 <img> 或自有资源）
 *   - swcMinify：Next 14 默认开启，无需显式声明
 *   - experimental.* （如 serverActions / runtime）：项目用 App Router 路由 + Route Handler，
 *     未启用 Server Actions，未用 Edge Runtime，无需 experimental 配置
 *   - i18n：Next 14 App Router 推荐用 middleware + 路由段实现 i18n，且项目当前仅中文，无需配置
 *   - webpack：未做自定义 webpack 配置，next 默认配置足够
 *   - env：环境变量通过 .env.local + Vercel Dashboard 注入，无需在 next.config.js 显式声明
 * 如未来接入 next/image 远程图片或 Server Actions，再补充对应配置。
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // 旧 NextAuth 登录流程
      {
        source: '/auth/:path*',
        destination: '/',
        permanent: true, // 301
      },
      // 旧 chat 流程
      {
        source: '/chat/:path*',
        destination: '/',
        permanent: true,
      },
      // 旧单次报告 API
      {
        source: '/api/summary',
        destination: '/',
        permanent: true,
      },
      {
        source: '/api/analyze',
        destination: '/',
        permanent: true,
      },
      // 旧 sessions API（多轮对话）
      {
        source: '/api/sessions/:path*',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
