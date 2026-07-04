/**
 * 问心 AI · 关系阶段判断函数
 *
 * 根据 D6（亲密激情）分数 + 配对时长（可选）推断关系阶段。
 * 阶段：honeymoon / adjustment / stable / crisis / rebirth
 */
import type { RelationshipStage } from './types';

/**
 * 根据 D6 亲密激情分数 + 配对时长（可选）推断关系阶段
 *
 * @param d6Score D6 维度分数（0-100）
 * @param monthsTogether 在一起的月数（可选，前端用户填，0=未填）
 */
export function classifyRelationshipStage(
  d6Score: number,
  monthsTogether = 0,
): RelationshipStage {
  // 高 D6 + 早期（<6 月）→ honeymoon
  if (d6Score >= 70 && monthsTogether > 0 && monthsTogether < 6)
    return 'honeymoon';
  // 高 D6 + 中期（6-24 月）→ adjustment
  if (d6Score >= 60 && monthsTogether >= 6 && monthsTogether < 24)
    return 'adjustment';
  // 中 D6 + 长期 → stable
  if (d6Score >= 50 && monthsTogether >= 24) return 'stable';
  // 低 D6 + 长期 → crisis
  if (d6Score < 40 && monthsTogether >= 12) return 'crisis';
  // 低 D6 升高 → rebirth（长期关系重新焕发）
  if (d6Score >= 60 && monthsTogether >= 36) return 'rebirth';
  // 未提供时长，按 D6 推断
  if (monthsTogether === 0) {
    if (d6Score >= 70) return 'honeymoon';
    if (d6Score >= 50) return 'stable';
    return 'adjustment';
  }
  // 默认
  return 'stable';
}
