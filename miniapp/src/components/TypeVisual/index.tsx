/**
 * 类型视觉卡组件（SVG 抽象几何图案）
 *
 * 基于 radarProfile 六维数据驱动生成「六边形数据花」：
 * - 中心六边形，6 顶点根据 D1-D6 数值向外延伸
 * - 相邻顶点用二次贝塞尔曲线连接，形成不规则花瓣
 * - 暖玫瑰径向渐变填充（opacity 0.15-0.45）
 * - rare 类型：外加金色虚线六边形 + 顶点星芒
 *
 * 视觉风格：暖色背景 + 暖玫瑰主色，无文字无 emoji。
 *
 * 渲染方式：SVG 字符串 → base64 data URI → Image 组件
 */
import { useMemo } from 'react';
import Taro from '@tarojs/taro';
import { View, Image } from '@tarojs/components';
import './index.scss';

interface RadarProfile {
  D1: number;
  D2: number;
  D3: number;
  D4: number;
  D5: number;
  D6: number;
}

interface TypeVisualProps {
  code: string;
  radarProfile: RadarProfile;
  rarity?: 'common' | 'rare';
  size?: number;
  className?: string;
}

const DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const;
const COLOR_ROSE = '#E8758A';
const COLOR_ROSE_DARK = '#9D2B4B';
const COLOR_GOLD = '#C9A961';
const COLOR_BG = '#FFF8F5';

function svgToBase64(svg: string): string {
  const escaped = encodeURIComponent(svg).replace(
    /%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode(parseInt(p1, 16)),
  );
  const bytes = new Uint8Array(escaped.length);
  for (let i = 0; i < escaped.length; i++) bytes[i] = escaped.charCodeAt(i);
  return Taro.arrayBufferToBase64(bytes.buffer);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export default function TypeVisual({
  code,
  radarProfile,
  rarity = 'common',
  size = 400,
  className = '',
}: TypeVisualProps) {
  const profileKey = DIMENSIONS.map((d) => `${d}:${radarProfile[d] ?? 0}`).join('|');

  const dataUri = useMemo(() => {
    const vb = 300;
    const cx = vb / 2;
    const cy = vb / 2;
    const maxR = 118;
    const minR = 32;
    const hash = hashString(code || '');
    const rotationOffset = (hash % 31) - 15;
    const petalPush = 10 + (hash % 11);

    const angles = DIMENSIONS.map(
      (_, i) => ((-90 + i * 60 + rotationOffset) * Math.PI) / 180,
    );

    const radiusAt = (val: number) => {
      const v = Math.max(0, Math.min(100, val ?? 0));
      return minR + (v / 100) * (maxR - minR);
    };

    const vertices: [number, number][] = DIMENSIONS.map((dim, i) => {
      const r = radiusAt(radarProfile[dim] ?? 0);
      return [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
    });

    const isRare = rarity === 'rare';
    const gidFill = `tvf-${code}`;
    const gidGlow = `tvg-${code}`;

    const parts: string[] = [];

    // defs：花瓣径向渐变（暖玫瑰）+ 中心光晕
    parts.push(
      `<defs>` +
        `<radialGradient id="${gidFill}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0%" stop-color="${COLOR_ROSE}" stop-opacity="0.45"/>` +
        `<stop offset="60%" stop-color="${COLOR_ROSE}" stop-opacity="0.25"/>` +
        `<stop offset="100%" stop-color="${COLOR_ROSE}" stop-opacity="0.08"/>` +
        `</radialGradient>` +
        `<radialGradient id="${gidGlow}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0%" stop-color="${COLOR_ROSE}" stop-opacity="0.55"/>` +
        `<stop offset="100%" stop-color="${COLOR_ROSE}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>`,
    );

    // 背景暖色圆
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${vb / 2}" fill="${COLOR_BG}"/>`);

    // 外圈极淡光环（暖玫瑰，opacity 0.12）
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${maxR + 8}" fill="none" stroke="${COLOR_ROSE}" stroke-width="1" stroke-opacity="0.12"/>`,
    );

    // rare：最外圈金色虚线六边形
    if (isRare) {
      const goldR = maxR + 18;
      const goldPts = DIMENSIONS.map((_, i) => {
        const a = ((-90 + i * 60 + rotationOffset) * Math.PI) / 180;
        return `${(cx + goldR * Math.cos(a)).toFixed(2)},${(cy + goldR * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      parts.push(
        `<polygon points="${goldPts}" fill="none" stroke="${COLOR_GOLD}" stroke-width="1.2" stroke-opacity="0.7" stroke-dasharray="4 3"/>`,
      );
    }

    // 花瓣路径
    const petalPath: string[] = [];
    for (let i = 0; i < 6; i++) {
      const [x1, y1] = vertices[i];
      const [x2, y2] = vertices[(i + 1) % 6];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = mx - cx;
      const dy = my - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const cxp = mx + (dx / dist) * petalPush;
      const cyp = my + (dy / dist) * petalPush;
      if (i === 0) petalPath.push(`M ${x1.toFixed(2)} ${y1.toFixed(2)}`);
      petalPath.push(
        `Q ${cxp.toFixed(2)} ${cyp.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      );
    }
    petalPath.push('Z');

    parts.push(
      `<path d="${petalPath.join(' ')}" fill="url(#${gidFill})" stroke="${COLOR_ROSE_DARK}" stroke-width="1.5" stroke-opacity="0.9" stroke-linejoin="round"/>`,
    );

    // 内层直线六边形（虚线）
    const innerPts = vertices
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');
    parts.push(
      `<polygon points="${innerPts}" fill="none" stroke="${COLOR_ROSE}" stroke-width="0.6" stroke-opacity="0.4" stroke-dasharray="2 2"/>`,
    );

    // 6 条径向辐条
    vertices.forEach(([x, y]) => {
      parts.push(
        `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${COLOR_ROSE}" stroke-width="0.5" stroke-opacity="0.25"/>`,
      );
    });

    // 中心光晕
    parts.push(`<circle cx="${cx}" cy="${cy}" r="22" fill="url(#${gidGlow})"/>`);

    // 顶点圆点（rare 用金色）
    vertices.forEach(([x, y]) => {
      parts.push(
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.6" fill="${isRare ? COLOR_GOLD : COLOR_ROSE_DARK}" fill-opacity="0.95"/>`,
      );
    });

    // rare：每个顶点加 4 向金色星芒
    if (isRare) {
      const sr = 5.5;
      vertices.forEach(([x, y]) => {
        for (let k = 0; k < 4; k++) {
          const a = (k * 45) * (Math.PI / 180);
          const x2 = x + sr * Math.cos(a);
          const y2 = y + sr * Math.sin(a);
          parts.push(
            `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${COLOR_GOLD}" stroke-width="0.6" stroke-opacity="0.75"/>`,
          );
        }
      });
    }

    // 中心实心点
    parts.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="${COLOR_ROSE_DARK}"/>`);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="${vb}" height="${vb}">${parts.join('')}</svg>`;
    return `data:image/svg+xml;base64,${svgToBase64(svg)}`;
  }, [code, profileKey, rarity]);

  const cls = ['type-visual', isRareClass(rarity), className]
    .filter(Boolean)
    .join(' ');

  return (
    <View className={cls}>
      <Image
        src={dataUri}
        mode="aspectFit"
        style={{ width: `${size}rpx`, height: `${size}rpx` }}
      />
    </View>
  );
}

function isRareClass(rarity: 'common' | 'rare'): string {
  return rarity === 'rare' ? 'rare' : '';
}
