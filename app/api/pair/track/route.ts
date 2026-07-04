/**
 * 分享事件追踪
 * POST /api/pair/track
 *
 * body: { pairSessionId, utmSource, utmMedium, utmCampaign, variant }
 *
 * 逻辑：
 * 1. 需登录
 * 2. 校验 pairSessionId 存在
 * 3. 落库 ShareEvent
 * 4. 返回 { success: true }
 *
 * 不校验是否为 A 或 B（分享卡片可能被第三方点击进入，utm_source=share_card 时也记录）
 * 但 sharerUserId 仅记录登录用户（A/B），匿名用户为 null
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { recordShareEvent, DEFAULT_UTM } from '@/lib/share-tracking';
import type { ApiResponse } from '@/shared/types';
import type { ShareVariant } from '@/shared/share-variants';

const VALID_VARIANTS = ['boast', 'selfmock', 'helpseek', 'mystery'] as const;
type ValidVariant = typeof VALID_VARIANTS[number];

function isValidVariant(v: unknown): v is ValidVariant {
  return typeof v === 'string' && (VALID_VARIANTS as readonly string[]).includes(v);
}

function isValidUtmString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 64;
}

interface TrackBody {
  pairSessionId: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  variant?: ShareVariant;
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthHeader(
      request.headers.get('Authorization'),
    );
    // 允许匿名（用户从分享卡片进入未登录场景），但 sharerUserId 为 null
    // 不强制 401，但记录时 userId 为 undefined → null

    const body = (await request.json()) as TrackBody;
    if (!body.pairSessionId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 pairSessionId' },
        { status: 400 },
      );
    }

    // W-3：参数校验，防止 variant 注入超长字符串 / 非法枚举值，utm 字段长度 ≤64
    if (body.variant && !isValidVariant(body.variant)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无效的 variant' },
        { status: 400 },
      );
    }
    if (body.utmSource && !isValidUtmString(body.utmSource)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'utmSource 长度需在 1-64 字符' },
        { status: 400 },
      );
    }
    if (body.utmMedium && !isValidUtmString(body.utmMedium)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'utmMedium 长度需在 1-64 字符' },
        { status: 400 },
      );
    }
    if (body.utmCampaign && !isValidUtmString(body.utmCampaign)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'utmCampaign 长度需在 1-64 字符' },
        { status: 400 },
      );
    }

    // 校验 pairSession 存在（避免脏数据）
    const pair = await prisma.pairSession.findUnique({
      where: { id: body.pairSessionId },
      select: { id: true },
    });
    if (!pair) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '配对记录不存在' },
        { status: 404 },
      );
    }

    await recordShareEvent({
      pairSessionId: body.pairSessionId,
      sharerUserId: userId ?? undefined,
      utm: {
        utmSource: body.utmSource || DEFAULT_UTM.utmSource,
        utmMedium: body.utmMedium || DEFAULT_UTM.utmMedium,
        utmCampaign: body.utmCampaign || DEFAULT_UTM.utmCampaign,
        variant: body.variant || DEFAULT_UTM.variant,
      },
    });

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '追踪失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
