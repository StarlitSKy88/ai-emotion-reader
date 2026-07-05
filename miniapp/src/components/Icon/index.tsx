/**
 * Icon 组件 — 轻量 SVG 图标库（lucide 风格）
 *
 * 设计:
 * - line icons,stroke 1.5-2,warm cream #DEDBC8 色调
 * - 因为微信小程序不支持内联 SVG 元素,改为生成 SVG 字符串经 base64 data URI 由 Image 渲染
 * - 不使用 btoa:小程序环境无 btoa,且 btoa 不能直接处理 Unicode
 *
 * 用法:
 *   <Icon name="check" />
 *   <Icon name="heart" size={64} color="#FF6B6B" />
 */
import { useMemo } from 'react';
import Taro from '@tarojs/taro';
import { View, Image } from '@tarojs/components';
import './index.scss';

export type IconName =
  | 'check'
  | 'circle'
  | 'arrow-right'
  | 'heart'
  | 'lock'
  | 'dot'
  | 'calendar'
  | 'trending'
  | 'sparkle';

export interface IconProps {
  name: IconName;
  /** rpx,默认 48 */
  size?: number;
  /** 默认 #DEDBC8 */
  color?: string;
  /** 默认 2 */
  strokeWidth?: number;
  className?: string;
}

/** 各图标的内部 SVG（lucide path,viewBox 0 0 24 24） */
const ICON_PATHS: Record<IconName, string> = {
  check: '<polyline points="20 6 9 17 4 12"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  'arrow-right':
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  heart:
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  lock:
    '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  trending:
    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  sparkle:
    '<path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/>',
};

const DEFAULT_COLOR = '#DEDBC8';

/**
 * 把 SVG 字符串（含 Unicode）转为 base64
 * 1. encodeURIComponent → UTF-8 字节序列（每个字节转为 %XX,再解为 charCode）
 * 2. 用 Taro.arrayBufferToBase64（微信小程序原生 API）转 base64
 *
 * 不使用 btoa:小程序环境无 btoa,且 btoa 不能直接处理 Unicode。
 */
function svgToBase64(svg: string): string {
  const escaped = encodeURIComponent(svg).replace(
    /%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode(parseInt(p1, 16)),
  );
  const bytes = new Uint8Array(escaped.length);
  for (let i = 0; i < escaped.length; i++) bytes[i] = escaped.charCodeAt(i);
  return Taro.arrayBufferToBase64(bytes.buffer);
}

function buildDataUri(name: IconName, color: string, strokeWidth: number): string {
  // currentColor 在 data URI Image 中无 CSS 上下文,会回退为黑色;
  // 直接替换为实际颜色值,既保留 SVG 规范写法,又保证渲染正确。
  // (dot 图标用 fill="currentColor" 表示实心填充)
  const inner = ICON_PATHS[name].replace(/currentColor/g, color);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${color}" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return `data:image/svg+xml;base64,${svgToBase64(svg)}`;
}

export default function Icon({
  name,
  size = 48,
  color = DEFAULT_COLOR,
  strokeWidth = 2,
  className = '',
}: IconProps) {
  const src = useMemo(
    () => buildDataUri(name, color, strokeWidth),
    [name, color, strokeWidth],
  );
  const cls = className ? `icon ${className}` : 'icon';
  return (
    <View className={cls}>
      <Image
        className='icon-image'
        src={src}
        mode='aspectFit'
        style={{ width: `${size}rpx`, height: `${size}rpx` }}
      />
    </View>
  );
}
