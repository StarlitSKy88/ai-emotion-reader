/**
 * 雷达图组件（6 维度）
 * - 纯 SVG 生成（小程序不支持内联 SVG 元素，改为生成 SVG 字符串经 data URI 由 Image 渲染）
 * - 支持单方分数和双方分数对比
 * - A 用问心粉 #E8657E，B 用蓝色 #4A90E2
 *
 * 注意：微信小程序 Image 组件对 URL-encoded SVG（data:image/svg+xml,…）支持不稳定，
 * 真机可能不渲染；这里统一改用 base64 编码（data:image/svg+xml;base64,…）。
 */
import { useMemo } from 'react';
import Taro from '@tarojs/taro';
import { View, Image, Text } from '@tarojs/components';
import './index.scss';

/**
 * 把 SVG 字符串（含 Unicode 中文）转为 base64
 * 1. UTF-8 编码为字节序列
 * 2. 用 Taro.arrayBufferToBase64（微信小程序原生 API）转 base64
 *
 * 不使用 btoa：小程序环境无 btoa，且 btoa 不能直接处理 Unicode。
 */
function svgToBase64(svg: string): string {
  // encodeURIComponent → UTF-8 字节序列（每个字节转为 %XX，再解为 charCode）
  const escaped = encodeURIComponent(svg).replace(
    /%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode(parseInt(p1, 16)),
  );
  const bytes = new Uint8Array(escaped.length);
  for (let i = 0; i < escaped.length; i++) bytes[i] = escaped.charCodeAt(i);
  return Taro.arrayBufferToBase64(bytes.buffer);
}

interface RadarChartProps {
  scoresA: Record<string, number>;
  scoresB?: Record<string, number>;
  /** 图表尺寸（rpx），默认 600 */
  size?: number;
  /** 维度标签，默认 { D1: '依恋', D2: '沟通', ... } */
  labels?: Record<string, string>;
}

const DEFAULT_LABELS: Record<string, string> = {
  D1: '依恋',
  D2: '沟通',
  D3: '修复',
  D4: '意义',
  D5: '信任',
  D6: '亲密',
};

const DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const;
const COLOR_A = '#E8657E';
const COLOR_B = '#4A90E2';

export default function RadarChart({
  scoresA,
  scoresB,
  size = 600,
  labels = DEFAULT_LABELS,
}: RadarChartProps) {
  const dataUri = useMemo(() => {
    const vb = 300; // viewBox 边长
    const cx = vb / 2;
    const cy = vb / 2;
    const maxR = 95; // 满分对应半径
    const labelR = maxR + 22; // 标签半径
    const rings = 5; // 5 圈同心六边形（20% → 100%）

    // 6 维度等分圆周，从正上方开始顺时针
    const angles = DIMENSIONS.map(
      (_, i) => (-90 + i * 60) * (Math.PI / 180),
    );

    const vertexAt = (r: number, i: number): [number, number] => [
      cx + r * Math.cos(angles[i]),
      cy + r * Math.sin(angles[i]),
    ];

    const hexPoints = (r: number) =>
      DIMENSIONS.map((_, i) => {
        const [x, y] = vertexAt(r, i);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');

    const scorePoints = (scores: Record<string, number>) =>
      DIMENSIONS.map((dim, i) => {
        const s = Math.max(0, Math.min(100, scores[dim] ?? 0));
        const [x, y] = vertexAt((s / 100) * maxR, i);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');

    const parts: string[] = [];

    // 网格：5 圈同心六边形
    for (let ring = 1; ring <= rings; ring++) {
      const r = (maxR * ring) / rings;
      parts.push(
        `<polygon points="${hexPoints(r)}" fill="none" stroke="#EAEAEA" stroke-width="1"/>`,
      );
    }

    // 6 条轴线
    DIMENSIONS.forEach((_, i) => {
      const [x, y] = vertexAt(maxR, i);
      parts.push(
        `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" stroke="#EAEAEA" stroke-width="1"/>`,
      );
    });

    // B 多边形（先画，置于 A 下方）
    if (scoresB) {
      parts.push(
        `<polygon points="${scorePoints(scoresB)}" fill="${COLOR_B}" fill-opacity="0.15" stroke="${COLOR_B}" stroke-width="2"/>`,
      );
      DIMENSIONS.forEach((dim, i) => {
        const s = Math.max(0, Math.min(100, scoresB[dim] ?? 0));
        const [x, y] = vertexAt((s / 100) * maxR, i);
        parts.push(
          `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="${COLOR_B}"/>`,
        );
      });
    }

    // A 多边形
    parts.push(
      `<polygon points="${scorePoints(scoresA)}" fill="${COLOR_A}" fill-opacity="0.2" stroke="${COLOR_A}" stroke-width="2"/>`,
    );
    DIMENSIONS.forEach((dim, i) => {
      const s = Math.max(0, Math.min(100, scoresA[dim] ?? 0));
      const [x, y] = vertexAt((s / 100) * maxR, i);
      parts.push(
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="${COLOR_A}"/>`,
      );
    });

    // 维度标签
    DIMENSIONS.forEach((dim, i) => {
      const [x, y] = vertexAt(labelR, i);
      parts.push(
        `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="13" fill="#666" font-family="sans-serif">${labels[dim] || dim}</text>`,
      );
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" width="${vb}" height="${vb}">${parts.join('')}</svg>`;
    return `data:image/svg+xml;base64,${svgToBase64(svg)}`;
  }, [scoresA, scoresB, labels]);

  return (
    <View className="radar-chart">
      <Image
        className="radar-image"
        src={dataUri}
        mode="aspectFit"
        style={{ width: `${size}rpx`, height: `${size}rpx` }}
      />
      {scoresB && (
        <View className="radar-legend">
          <View className="legend-item">
            <View className="legend-dot legend-dot-a" />
            <Text className="legend-text">我</Text>
          </View>
          <View className="legend-item">
            <View className="legend-dot legend-dot-b" />
            <Text className="legend-text">TA</Text>
          </View>
        </View>
      )}
    </View>
  );
}
