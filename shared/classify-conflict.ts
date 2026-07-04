/**
 * 问心 AI · 冲突模式分类函数
 *
 * 根据 D2（沟通质量）/ D3（修复能力）维度分数推断冲突模式。
 * 理论依据：Sue Johnson《Attachment Theory in Practice》EFT 追-逃循环分类
 *           + Gottman 修复尝试理论（repair attempts）
 *
 * B-PS-1 修复：原逻辑 D2 低 + D3 高 → pursue-withdraw 反直觉（D3 高修复能力
 * 却映射追-逃循环），D2 高 + D3 低 → pursue-pursue 也反直觉（D2 高沟通却映射
 * 双方追逐）。已对齐 EFT 理论重写如下：
 * - D2 高 + D3 高 → repair（修复型，健康）
 * - D2 低 + D3 低 → pursue-withdraw（追-逃循环，沟通差 + 修复差）
 * - D2 高 + D3 低 → withdraw-withdraw（沟通功能性高但情感退缩）
 * - D2 低 + D3 高 → pursue-pursue（双方都激烈追逐但能修复，稀有模式）
 */
import type { ConflictPattern } from './types';

/**
 * 根据 D2/D3 维度分数推断冲突模式
 *
 * @param d2Score D2 沟通质量分数（0-100）
 * @param d3Score D3 修复能力分数（0-100）
 * @returns ConflictPattern
 */
export function classifyConflictPattern(
  d2Score: number,
  d3Score: number,
): ConflictPattern {
  // B-PS-1 修复后逻辑（对齐 EFT 理论）
  // D2 沟通质量高 + D3 修复好 → repair（修复型，健康）
  if (d2Score >= 60 && d3Score >= 60) return 'repair';
  // D2 低 + D3 低 → pursue-withdraw（追-逃循环，沟通差 + 修复差）
  if (d2Score < 50 && d3Score < 50) return 'pursue-withdraw';
  // D2 高 + D3 低 → withdraw-withdraw（沟通功能性高但情感退缩）
  if (d2Score >= 50 && d3Score < 50) return 'withdraw-withdraw';
  // D2 低 + D3 高 → pursue-pursue（双方都激烈追逐但能修复，稀有模式）
  if (d2Score < 50 && d3Score >= 50) return 'pursue-pursue';
  // 中间态（D2/D3 在 50-60 区间未命中以上）默认追-逃
  return 'pursue-withdraw';
}
