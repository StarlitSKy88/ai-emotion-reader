/**
 * 类型视觉卡组件（SVG 抽象几何图案）
 *
 * 基于 radarProfile 六维数据驱动生成「六边形数据花」（方案 A）：
 * - 中心一个六边形，6 个顶点根据 D1-D6 数值向外延伸（数值越大顶点越远）
 * - 相邻顶点用二次贝塞尔曲线连接，控制点向外推，形成不规则花瓣
 * - 内部 warm cream 径向渐变填充（opacity 0.05-0.35）
 * - 边缘描边 warm cream
 * - rare 类型：外加一圈金色虚线六边形 + 顶点星芒
 *
 * 视觉风格：深色背景 + warm cream 主色 + 低饱和，无文字无 emoji。
 *
 * 渲染方式同 RadarChart：SVG 字符串 → base64 data URI → Image 组件
 * （微信小程序不支持内联 SVG 元素）。
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
  /** 类型 code，用于唯一标识 + 派生微小旋转偏移 */
  code: string;
  radarProfile: RadarProfile;
  rarity?: 'common' | 'rare';
  /** 图像尺寸（rpx），默认 400 */
  size?: number;
  className?: string;
}

const DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const;
const COLOR_CREAM = '#DEDBC8';
const COLOR_GOLD = '#FFD700';
const COLOR_BG = '#0A0A0A';

/**
 * 把 SVG 字符串（含 Unicode）转为 base64
 * 复用 RadarChart 的实现：encodeURIComponent → UTF-8 字节 → Taro.arrayBufferToBase64
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

/** 简易字符串 hash，用于派生每类型的微小变量（旋转、花瓣外推） */
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
  // 序列化 radarProfile 用于依赖比较（避免对象引用变化导致重算）
  const profileKey = DIMENSIONS.map((d) => `${d}:${radarProfile[d] ?? 0}`).join('|');

  const dataUri = useMemo(() => {
    const vb = 300; // viewBox 边长
    const cx = vb / 2;
    const cy = vb / 2;
    const maxR = 118; // 满分对应半径
    const minR = 32; // 零分对应半径（保留最小形状）
    const hash = hashString(code || '');
    // 每类型微小旋转偏移（-15° ~ +15°），保持数据驱动主导，但让相同 profile 的不同类型也有差异
    const rotationOffset = (hash % 31) - 15;
    // 花瓣外推量（10-20），每类型不同，决定花瓣弧度
    const petalPush = 10 + (hash % 11);

    // 6 维度等分圆周，从正上方开始顺时针，叠加每类型旋转
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
    // 渐变 ID 加 code 后缀，避免同页面多实例 ID 冲突
    const gidFill = `tvf-${code}`;
    const gidGlow = `tvg-${code}`;

    const parts: string[] = [];

    // defs：花瓣径向渐变 + 中心光晕
    parts.push(
      `<defs>` +
        `<radialGradient id="${gidFill}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0%" stop-color="${COLOR_CREAM}" stop-opacity="0.35"/>` +
        `<stop offset="60%" stop-color="${COLOR_CREAM}" stop-opacity="0.18"/>` +
        `<stop offset="100%" stop-color="${COLOR_CREAM}" stop-opacity="0.05"/>` +
        `</radialGradient>` +
        `<radialGradient id="${gidGlow}" cx="50%" cy="50%" r="50%">` +
        `<stop offset="0%" stop-color="${COLOR_CREAM}" stop-opacity="0.45"/>` +
        `<stop offset="100%" stop-color="${COLOR_CREAM}" stop-opacity="0"/>` +
        `</radialGradient>` +
        `</defs>`,
    );

    // 背景深色圆
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${vb / 2}" fill="${COLOR_BG}"/>`);

    // 外圈极淡光环（warm cream，opacity 0.08）
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${maxR + 8}" fill="none" stroke="${COLOR_CREAM}" stroke-width="1" stroke-opacity="0.08"/>`,
    );

    // rare：最外圈金色虚线六边形
    if (isRare) {
      const goldR = maxR + 18;
      const goldPts = DIMENSIONS.map((_, i) => {
        const a = ((-90 + i * 60 + rotationOffset) * Math.PI) / 180;
        return `${(cx + goldR * Math.cos(a)).toFixed(2)},${(cy + goldR * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      parts.push(
        `<polygon points="${goldPts}" fill="none" stroke="${COLOR_GOLD}" stroke-width="1.2" stroke-opacity="0.65" stroke-dasharray="4 3"/>`,
      );
    }

    // 花瓣路径：6 段二次贝塞尔，相邻顶点之间控制点沿外法线方向外推
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
      `<path d="${petalPath.join(' ')}" fill="url(#${gidFill})" stroke="${COLOR_CREAM}" stroke-width="1.5" stroke-opacity="0.85" stroke-linejoin="round"/>`,
    );

    // 内层直线六边形（虚线，低 opacity，呼应数据骨架）
    const innerPts = vertices
      .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');
    parts.push(
      `<polygon points="${innerPts}" fill="none" stroke="${COLOR_CREAM}" stroke-width="0.6" stroke-opacity="0.35" stroke-dasharray="2 2"/>`,
    );

    // 6 条径向辐条（中心到顶点，极淡）
    vertices.forEach(([x, y]) => {
      parts.push(
        `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${COLOR_CREAM}" stroke-width="0.5" stroke-opacity="0.22"/>`,
      );
    });

    // 中心光晕
    parts.push(`<circle cx="${cx}" cy="${cy}" r="22" fill="url(#${gidGlow})"/>`);

    // 顶点圆点（rare 用金色）
    vertices.forEach(([x, y]) => {
      parts.push(
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.6" fill="${isRare ? COLOR_GOLD : COLOR_CREAM}" fill-opacity="0.95"/>`,
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
            `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${COLOR_GOLD}" stroke-width="0.6" stroke-opacity="0.7"/>`,
          );
        }
      });
    }

    // 中心实心点
    parts.push(`<circle cx="${cx}" cy="${cy}" r="3" fill="${COLOR_CREAM}"/>`);

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
