/**
 * 通用埋点上报（Phase 6.6）
 * POST /api/track
 *
 * body: { events: [{ event, props, timestamp }] }
 *
 * 流程：
 * 1. 不强制鉴权（允许匿名事件，如落地页访问）
 * 2. 已登录时通过 token 反查 userId（事件归属到用户）
 * 3. 校验事件数量（单次 ≤20 条）
 * 4. 校验事件名（仅 [a-z_]+，最长 64 字符）
 * 5. 批量插入 TrackEvent
 *
 * 安全：
 * - 事件名/属性白名单校验（防止 SQL 注入 / 超长字段）
 * - 单次请求事件数 ≤20（防止批量刷量）
 * - 字符串字段最长 256 字符
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { ApiResponse } from '@/shared/types';

/** 事件名合法字符集 */
const EVENT_NAME_REGEX = /^[a-z_]{1,64}$/;

/** 单次请求最大事件数 */
const MAX_EVENTS_PER_REQUEST = 20;

/** 事件属性最长字符数 */
const MAX_PROP_STRING_LENGTH = 256;

/**
 * V2 优化（W-5）：原 source 字段硬编码为 'miniapp'，无法区分 web/miniapp/api 来源；
 * 改为从 request headers 动态识别。
 *
 * 优先级：
 * 1. 显式 X-Source 头（可信前端/服务端调用方可指定 'web' / 'miniapp' / 'api'）
 * 2. User-Agent 启发式：含 miniapp / miniprogram 视为小程序；含 Mozilla/Chrome 等「浏览器特征」视为 web
 * 3. 兜底 'unknown'
 *
 * 注：UA 可被伪造，仅用于粗粒度统计分桶，不做安全决策。
 */
function detectSource(request: NextRequest): string {
  const explicit = request.headers.get('X-Source');
  if (explicit) {
    const trimmed = explicit.trim().toLowerCase();
    if (trimmed === 'web' || trimmed === 'miniapp' || trimmed === 'api') {
      return trimmed;
    }
  }

  const ua = request.headers.get('User-Agent') || '';
  // 微信小程序 webview / 服务端 wx.request UA 通常含 miniapp 或 miniprogram
  if (/miniapp|miniprogram|micromessenger/i.test(ua)) {
    return 'miniapp';
  }
  // 浏览器 UA 通常含 Mozilla，但小程序 webview 也含 Mozilla，故放在 miniapp 判断之后
  if (/mozilla|chrome|safari|firefox|edge/i.test(ua)) {
    return 'web';
  }
  // 无 UA 或非浏览器特征（如 curl、服务端 fetch）视为 api
  return 'unknown';
}

interface TrackItem {
  event: string;
  props?: Record<string, unknown>;
  timestamp?: number;
}

interface TrackBody {
  events: TrackItem[];
}

/**
 * 安全清理事件属性
 * - 字符串截断到 256 字符
 * - 数字/布尔值原样保留
 * - 其他类型跳过
 */
function sanitizeProps(
  props: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  if (!props || typeof props !== 'object') return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (typeof value === 'string') {
      result[key] = value.slice(0, MAX_PROP_STRING_LENGTH);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    // 可选鉴权：已登录则反查 userId，未登录则 userId=null
    const userId = getUserIdFromAuthHeader(
      request.headers.get('Authorization'),
    );

    // V2 优化（W-5）：从 headers 动态识别来源（X-Source 或 User-Agent）
    const source = detectSource(request);

    const body = (await request.json()) as TrackBody;
    if (!body.events || !Array.isArray(body.events)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'events 字段必须是数组' },
        { status: 400 },
      );
    }

    if (body.events.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true });
    }

    if (body.events.length > MAX_EVENTS_PER_REQUEST) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `单次请求事件数不能超过 ${MAX_EVENTS_PER_REQUEST} 条`,
        },
        { status: 400 },
      );
    }

    // 校验每条事件
    const validEvents: Array<{
      userId: string | null;
      event: string;
      props: Record<string, string | number | boolean>;
      source: string;
    }> = [];

    for (const item of body.events) {
      if (!item.event || typeof item.event !== 'string') continue;
      if (!EVENT_NAME_REGEX.test(item.event)) continue;

      validEvents.push({
        userId,
        event: item.event,
        props: sanitizeProps(item.props),
        // V2 优化（W-5）：原硬编码 'miniapp'，改为 detectSource 动态识别
        source,
      });
    }

    if (validEvents.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无有效事件' },
        { status: 400 },
      );
    }

    // 批量插入（不阻塞太久，500ms 内应返回）
    await prisma.trackEvent.createMany({
      data: validEvents.map((e) => ({
        userId: e.userId,
        event: e.event,
        props: e.props,
        source: e.source,
      })),
    });

    return NextResponse.json<ApiResponse>({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '埋点上报失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
