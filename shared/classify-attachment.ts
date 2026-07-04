/**
 * 问心 AI · 依恋风格分类函数
 *
 * 根据 D1 分数 + ECR-R 风格标记推断依恋风格。
 * D1 维度（依恋安全感）分数 0-100，越高越安全。
 */
import type { AttachmentStyle } from './types';

/**
 * 根据 D1 分数 + ECR-R 风格标记推断依恋风格
 *
 * @param d1Score D1 维度分数（0-100）
 * @param dominantStyle 该用户在 D1 题组中占比最高的 attachment 标记（'S'|'A'|'D'|'F'）
 * @returns AttachmentStyle
 */
export function classifyAttachment(
  d1Score: number,
  dominantStyle?: AttachmentStyle,
): AttachmentStyle {
  // D1≥75 → S（安全）
  if (d1Score >= 75) return 'S';
  // D1<50 → 按 dominantStyle（A/D/F），无 dominantStyle 默认 D
  if (d1Score < 50) return dominantStyle || 'D';
  // 50-75 之间：按 dominantStyle，无则 'S'（中间偏安全）
  return dominantStyle || 'S';
}

/**
 * 计算 D1 题组中占比最高的 attachment 标记
 *
 * @param d1Answers D1 题答案（label 数组）
 * @param d1Questions D1 题组题目（含每题选项的 attachment 标记）
 */
export function getDominantAttachment(
  d1Answers: Record<string, string>,
  d1Questions: Array<{
    id: string;
    options: Array<{ label: string; attachment?: string }>;
  }>,
): AttachmentStyle | undefined {
  const counts: Record<string, number> = { S: 0, A: 0, D: 0, F: 0 };
  for (const q of d1Questions) {
    const ans = d1Answers[q.id];
    if (!ans) continue;
    const opt = q.options.find((o) => o.label === ans);
    if (opt?.attachment) counts[opt.attachment]++;
  }
  const max = Math.max(counts.S, counts.A, counts.D, counts.F);
  if (max === 0) return undefined;
  // 优先返回占比最高的
  const sorted = (Object.entries(counts) as [string, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  return sorted[0][0] as AttachmentStyle;
}
