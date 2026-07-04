/**
 * 分享与扫码工具
 *
 * 三种分享场景：
 * 1. 邀请测试：A 答完后分享给 B，B 点击进入路径选择页（带 inviterTestSessionId），由 B 自行选择是否作为 A 的伴侣
 * 2. 分享结果：B 已分享给 A 后，A/B 都可分享结果到朋友圈引流
 * 3. 分享类型百科：从首页类型百科入口分享特定类型（Phase 1 再补落地页）
 *
 * 扫码机制：
 * - 微信小程序码：通过 wxacode.getUnlimited API 生成，scene 携带 testSessionId
 * - 用户扫码 → 进入小程序 → 解析 scene → 跳转路径选择页（B 模式，带 inviterTestSessionId）
 * - scene 格式：t=<testSessionId>（小程序码 scene 限 32 字符，testSessionId 是 cuid 25 字符，加上 t= 共 27 字符，符合限制）
 */
import Taro from '@tarojs/taro';
import { buildSharePathWithUtm } from './utm';
import type { UtmParams } from './utm';

/** 分享类型 */
export type ShareType = 'invite-test' | 'share-result' | 'share-type';

export interface SharePayload {
  /** A 的测试会话 ID（邀请测试用） */
  testSessionId?: string;
  /** 配对会话 ID（分享结果用） */
  pairSessionId?: string;
  /** 类型 code（分享类型百科用） */
  typeCode?: string;
  /** 类型名（用于分享标题） */
  typeName?: string;
  /** 是否同性组合（true 时不暴露类型名，隐私保护） */
  isSameSex?: boolean;
  /** utm 追踪参数（分享结果用，可选，存在时拼接到 path） */
  utm?: UtmParams;
}

export interface ShareConfig {
  title: string;
  path: string;
  imageUrl?: string;
}

/** 生成分享配置 */
export function buildShareConfig(type: ShareType, payload: SharePayload = {}): ShareConfig {
  switch (type) {
    case 'invite-test':
      // B 点击分享卡片进入路径选择页（带 inviterTestSessionId），由 B 决定是否作为 A 的伴侣
      return {
        title: '我们来做一道情侣测试吧，看看你们的匹配度',
        path: `/pages/invite/join?inviterTestSessionId=${payload.testSessionId || ''}`,
        imageUrl: '/assets/share/test-share.png',
      };
    case 'share-result': {
      const basePath = `/pages/result/index?pairSessionId=${payload.pairSessionId || ''}`;
      // W-12：同性组合不暴露类型名，标题用通用文案（隐私保护）
      const showTypeName = payload.typeName && !payload.isSameSex;
      return {
        title: showTypeName
          ? `我们的关系类型是「${payload.typeName}」`
          : '我们做完情侣测试了，来看看结果',
        path: payload.utm ? buildSharePathWithUtm(basePath, payload.utm) : basePath,
        imageUrl: '/assets/share/result-share.png',
      };
    }
    case 'share-type':
      // 类型百科落地页未实现，暂时回到首页
      return {
        title: `情侣类型百科：${payload.typeName || ''}`,
        path: `/pages/index/index`,
        imageUrl: '/assets/share/type-share.png',
      };
  }
}

/**
 * 解析小程序码 scene
 * @param scene 微信扫码进入时携带的 scene 字符串
 * @returns 解析后的参数对象
 *
 * scene 格式约定：
 * - "t=<testSessionId>"  邀请测试
 * - "r=<pairSessionId>"  分享结果
 * - "p=<typeCode>"       分享类型
 */
export function parseScene(scene: string): {
  testSessionId?: string;
  pairSessionId?: string;
  typeCode?: string;
} {
  const result: {
    testSessionId?: string;
    pairSessionId?: string;
    typeCode?: string;
  } = {};
  if (!scene) return result;

  // scene 可能被 encodeURIComponent 编码过
  const decoded = decodeURIComponent(scene);
  const pairs = decoded.split('&');
  for (const p of pairs) {
    const [k, v] = p.split('=');
    if (k === 't') result.testSessionId = v;
    else if (k === 'r') result.pairSessionId = v;
    else if (k === 'p') result.typeCode = v;
  }
  return result;
}

/**
 * 启动时处理扫码进入
 * 在 app.tsx 的 onLaunch 或首页 onLoad 中调用
 *
 * @returns 跳转的目标 url，未跳转返回 null
 */
export function handleScanEntry(options: { scene?: string } = {}): string | null {
  const scene = options.scene;
  if (!scene) return null;

  const parsed = parseScene(scene);
  if (parsed.testSessionId) {
    // B 扫码进入路径选择页（带 inviterTestSessionId），由 B 决定是否作为 A 的伴侣
    return `/pages/invite/join?inviterTestSessionId=${parsed.testSessionId}`;
  }
  if (parsed.pairSessionId) {
    return `/pages/result/index?pairSessionId=${parsed.pairSessionId}`;
  }
  if (parsed.typeCode) {
    // 类型百科落地页未实现，暂时回到首页
    return `/pages/index/index`;
  }
  return null;
}

/**
 * 触发分享（备用方案）
 * 实际推荐使用 <Button openType="share"> 触发，本函数用于编程式分享
 */
export function triggerShare(config: ShareConfig): void {
  // Taro 的 useShareAppMessage 钩子优先级更高
  // 这里仅作为 fallback，将配置存到全局，下次分享时读取
  Taro.setStorageSync('pending_share', config);
}

/**
 * 复制邀请文案到剪贴板
 */
export function copyInviteText(): void {
  Taro.setClipboardData({
    data: '来测测我们的情侣匹配度吧，30 题 3 分钟，看见你们的关系',
  });
}
