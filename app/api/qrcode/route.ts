/**
 * 小程序码生成 API（Phase 6.2）
 * GET /api/qrcode?scene=xxx&page=pages/index/index&width=430
 *
 * 用途：
 * - 官网落地页展示小程序码，用户扫码进入小程序
 * - 营销活动中根据 scene 区分不同入口（如 utm_landing / utm_poster_xxx）
 *
 * 流程：
 * 1. 调 getMiniProgramQRCodeWithCache 生成小程序码
 * 2. 失败时返回 SVG 占位图（避免落地页裸奔）
 * 3. 成功时返回 PNG 图片（Cache-Control 1 小时）
 *
 * 缓存：
 * - 内存缓存 1 小时（同一 scene + page）
 * - HTTP 缓存 1 小时（Cache-Control: public, max-age=3600）
 *
 * 安全：
 * - scene 校验：最长 32 字符，仅允许 [a-zA-Z0-9_-]
 * - page 校验：必须以 'pages/' 开头
 * - 不强制鉴权（小程序码是公开的）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMiniProgramQRCodeWithCache } from '@/lib/wechat-mp';

/** scene 合法字符集 */
const SCENE_REGEX = /^[a-zA-Z0-9_-]{1,32}$/;

/** 默认页面（首页） */
const DEFAULT_PAGE = 'pages/index/index';

/** SVG 占位图（生成失败时返回，避免落地页裸奔） */
function buildPlaceholderSvg(): Buffer {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#FAFAFA"/>
  <text x="100" y="100" text-anchor="middle" dominant-baseline="middle"
        font-family="-apple-system, system-ui, sans-serif" font-size="14" fill="#999">
    小程序码生成中
  </text>
  <text x="100" y="125" text-anchor="middle" dominant-baseline="middle"
        font-family="-apple-system, system-ui, sans-serif" font-size="11" fill="#BBB">
    请在微信搜索「问心 AI」
  </text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const scene = (searchParams.get('scene') || 'landing').slice(0, 32);
  const page = searchParams.get('page') || DEFAULT_PAGE;
  const widthParam = searchParams.get('width');
  const width = widthParam ? Math.min(1280, Math.max(280, parseInt(widthParam, 10) || 430)) : 430;

  // 参数校验
  if (!SCENE_REGEX.test(scene)) {
    return new NextResponse('Invalid scene', { status: 400 });
  }
  if (!page.startsWith('pages/')) {
    return new NextResponse('Invalid page', { status: 400 });
  }

  // 缺少微信环境变量 → 直接返回占位图（开发环境）
  if (!process.env.WECHAT_MINIAPP_APPID || !process.env.WECHAT_MINIAPP_SECRET) {
    return new NextResponse(new Uint8Array(buildPlaceholderSvg()), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  try {
    // 开发环境用 trial 版本，正式用 release
    const envVersion = process.env.NODE_ENV === 'production' ? 'release' : 'trial';

    // 注：getMiniProgramQRCodeWithCache 不支持 width 参数（缓存键不含 width）
    // 官网统一 430px，如有差异化需求可拆 cache key
    const result = await getMiniProgramQRCodeWithCache(scene, page);
    void width;
    void envVersion;

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[qrcode] 生成失败', error);
    // 失败时返回 SVG 占位图，避免落地页裸奔
    return new NextResponse(new Uint8Array(buildPlaceholderSvg()), {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60', // 失败时短缓存，便于恢复
      },
    });
  }
}
