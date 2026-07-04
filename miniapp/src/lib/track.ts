/**
 * 埋点 SDK（Phase 6.6）
 *
 * 提供小程序端统一的事件上报能力，所有关键行为通过此 SDK 上报。
 *
 * 设计原则：
 * - fire-and-forget：上报失败不阻塞业务流程
 * - 批量合并：短时间内的多个事件合并一次请求（V2 实现，MVP 单条上报）
 * - 本地缓存：网络异常时缓存到 Storage，下次启动重试（V2 实现）
 *
 * 事件命名规范：object_action
 * - page_view：页面浏览
 * - test_start：开始测试
 * - test_complete：完成测试
 * - pair_invite：邀请配对
 * - pair_join：加入配对
 * - task_view：查看任务
 * - task_complete：完成任务
 * - task_skip：跳过任务
 * - share_complete：完成分享
 * - subscribe_click：点击订阅
 * - subscribe_success：订阅成功
 * - crisis_redirect：危机转介
 *
 * 上报路径：POST /api/track
 */
import Taro from '@tarojs/taro';
import { http } from './request';
import { isLoggedIn } from './auth';

/** 事件属性类型 */
export interface TrackProps {
  [key: string]: string | number | boolean | null | undefined;
}

/** 事件来源 */
export type TrackSource = 'miniapp' | 'web';

/** 待上报事件队列（用于批量合并，MVP 阶段单条上报） */
interface TrackItem {
  event: string;
  props: TrackProps;
  timestamp: number;
}

/** 上报接口的请求体 */
interface TrackRequestBody {
  events: TrackItem[];
}

/**
 * 上报单个事件
 *
 * @param event 事件名（如 page_view）
 * @param props 事件属性
 * @returns Promise<void>（fire-and-forget，错误吞掉不抛出）
 */
export async function trackEvent(
  event: string,
  props: TrackProps = {},
): Promise<void> {
  try {
    const item: TrackItem = {
      event,
      props: sanitizeProps(props),
      timestamp: Date.now(),
    };

    // 不强制鉴权（允许匿名事件，如落地页访问）
    // 但已登录时自动带 token（接口会用 token 反查 userId）
    await http.post<{ success: boolean }>('/api/track', { events: [item] });
  } catch (e) {
    // 静默失败，不阻塞业务
    console.warn('[track] 上报失败', event, e);
  }
}

/**
 * 批量上报事件（V2 预留，MVP 阶段也可用）
 *
 * @param events 事件数组
 */
export async function trackEvents(
  events: Array<{ event: string; props?: TrackProps }>,
): Promise<void> {
  if (!events.length) return;
  try {
    const items: TrackItem[] = events.map((e) => ({
      event: e.event,
      props: sanitizeProps(e.props || {}),
      timestamp: Date.now(),
    }));
    await http.post<{ success: boolean }>('/api/track', { events: items });
  } catch (e) {
    console.warn('[track] 批量上报失败', e);
  }
}

/**
 * 页面浏览埋点（封装常用场景）
 *
 * @param page 页面路径（如 'pages/index/index'）
 * @param extra 额外属性
 */
export function trackPageView(
  page: string,
  extra: TrackProps = {},
): void {
  void trackEvent('page_view', { page, ...extra });
}

/**
 * 清理事件属性（防止超长字符串 / 非法类型进入 DB）
 */
function sanitizeProps(props: TrackProps): TrackProps {
  const result: TrackProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (typeof value === 'string') {
      // 字符串最长 256 字符，超出截断
      result[key] = value.slice(0, 256);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
    // 其他类型跳过
  }
  return result;
}

// ====================================================================
// 常用事件快捷方法（语义化封装）
// ====================================================================

/** 测试开始 */
export function trackTestStart(testVersion?: string): void {
  void trackEvent('test_start', { testVersion });
}

/** 测试完成 */
export function trackTestComplete(pairSessionId?: string): void {
  void trackEvent('test_complete', { pairSessionId });
}

/** 邀请联系人配对 */
export function trackPairInvite(channel: 'wechat' | 'share_card' | 'qrcode'): void {
  void trackEvent('pair_invite', { channel });
}

/** 加入配对 */
export function trackPairJoin(pairSessionId?: string): void {
  void trackEvent('pair_join', { pairSessionId });
}

/** 查看任务详情 */
export function trackTaskView(taskId: string, sourceDimension?: string): void {
  void trackEvent('task_view', { taskId, sourceDimension });
}

/** 完成任务 */
export function trackTaskComplete(taskId: string, hasMedia: boolean): void {
  void trackEvent('task_complete', { taskId, hasMedia });
}

/** 跳过任务 */
export function trackTaskSkip(taskId: string): void {
  void trackEvent('task_skip', { taskId });
}

/** 完成分享 */
export function trackShareComplete(
  variant: string,
  pairSessionId?: string,
): void {
  void trackEvent('share_complete', { variant, pairSessionId });
}

/** 点击订阅 */
export function trackSubscribeClick(plan: 'monthly' | 'yearly'): void {
  void trackEvent('subscribe_click', { plan });
}

/** 订阅成功 */
export function trackSubscribeSuccess(
  plan: 'monthly' | 'yearly',
  amountFen: number,
): void {
  void trackEvent('subscribe_success', { plan, amountFen });
}

/** 危机转介触发 */
export function trackCrisisRedirect(level: 'middle' | 'high'): void {
  void trackEvent('crisis_redirect', { level });
}

/**
 * 在 useDidShow 中自动埋点 page_view
 *
 * 用法：
 * ```ts
 * useDidShow(() => {
 *   trackPageView('pages/tasks/index');
 *   // 其他逻辑
 * });
 * ```
 *
 * 注：Taro 的 useDidShow 已在多个页面使用，这里只提供工具函数，不强制封装 Hook
 */

/**
 * 检查用户登录状态并返回 userId（用于事件上报）
 */
export function getCurrentUserIdForTrack(): string | null {
  if (!isLoggedIn()) return null;
  try {
    const user = Taro.getStorageSync('user');
    if (user && typeof user === 'object' && 'id' in user) {
      return String((user as { id: string }).id);
    }
  } catch {
    // ignore
  }
  return null;
}
