/**
 * 问心 AI · 情侣类型匹配引擎（Phase 3 核心）
 *
 * 6 个原子点：
 * 3.1.1 依恋风格分类（classify-attachment）
 * 3.1.2 冲突模式分类（classify-conflict）
 * 3.1.3 关系阶段判断（classify-stage）
 * 3.1.4 三元组精确匹配（attachmentCombo × conflictPattern × stage）
 * 3.1.5 性别组合触发类型库
 * 3.1.6 相似度回退（欧氏距离 → 0-100 分）
 */
import type {
  AttachmentStyle,
  ConflictPattern,
  CoupleTypeInfo,
  DimensionScores,
  GenderCombo,
  RelationshipStage,
  TypeMatchResult,
} from '@/shared/types';
import { getCoupleTypesByGenderCombo } from '@/shared/couple-types-all';
import { classifyAttachment } from '@/shared/classify-attachment';
import { classifyConflictPattern } from '@/shared/classify-conflict';
import { classifyRelationshipStage } from '@/shared/classify-stage';

/** 双方合并特征 */
interface CoupleProfile {
  /** 依恋组合，如 'S×S' / 'A×D'（A 在前 B 在后） */
  attachmentCombo: string;
  /** 冲突模式（取双方 D2/D3 均值推断） */
  conflictPattern: ConflictPattern;
  /** 关系阶段（取双方 D6 均值推断） */
  stage: RelationshipStage;
  /** A 的 6 维度分数 */
  dimensionsA: DimensionScores;
  /** B 的 6 维度分数 */
  dimensionsB: DimensionScores;
}

/**
 * 根据双方用户特征构建 CoupleProfile
 *
 * @param dimsA A 的 6 维度分数
 * @param dimsB B 的 6 维度分数
 * @param dominantStyleA A 在 D1 题组中占比最高的 attachment 标记
 * @param dominantStyleB B 在 D1 题组中占比最高的 attachment 标记
 * @param monthsTogether 在一起的月数（可选）
 */
export function buildCoupleProfile(
  dimsA: DimensionScores,
  dimsB: DimensionScores,
  dominantStyleA?: AttachmentStyle,
  dominantStyleB?: AttachmentStyle,
  monthsTogether = 0,
): CoupleProfile {
  const attachA = classifyAttachment(dimsA.D1, dominantStyleA);
  const attachB = classifyAttachment(dimsB.D1, dominantStyleB);
  // 冲突模式：取双方 D2/D3 均值
  const d2Avg = (dimsA.D2 + dimsB.D2) / 2;
  const d3Avg = (dimsA.D3 + dimsB.D3) / 2;
  const conflictPattern = classifyConflictPattern(d2Avg, d3Avg);
  // 关系阶段：取双方 D6 均值
  const d6Avg = (dimsA.D6 + dimsB.D6) / 2;
  const stage = classifyRelationshipStage(d6Avg, monthsTogether);
  return {
    attachmentCombo: `${attachA}×${attachB}`,
    conflictPattern,
    stage,
    dimensionsA: dimsA,
    dimensionsB: dimsB,
  };
}

/**
 * 把 attachmentCombo 字符串展开为所有可能的具体组合集合
 * 'S×S' → ['S×S']
 * 'S/D×S/D' → ['S×S', 'S×D', 'D×S', 'D×D']
 * 'A×A|S×S' → ['A×A', 'S×S']
 * '*×*' → ['*×*']（通配符，匹配所有）
 */
function expandAttachmentCombos(combo: string): string[] {
  // 先按 | 分隔多组合
  const variants = combo.split('|').map((s) => s.trim());
  const result: string[] = [];
  for (const v of variants) {
    if (v === '*×*') {
      result.push('*×*');
      continue;
    }
    // 按 × 分隔左右
    const [left, right] = v.split('×').map((s) => s.trim());
    // 左右可能含 / 表示多选
    const lefts = left.split('/').map((s) => s.trim());
    const rights = right.split('/').map((s) => s.trim());
    for (const l of lefts) {
      for (const r of rights) {
        result.push(`${l}×${r}`);
      }
    }
  }
  return result;
}

/** 检查 profile 的 attachmentCombo 是否匹配 type 的 attachmentCombo */
function attachmentComboMatches(typeCombo: string, profileCombo: string): boolean {
  const expanded = expandAttachmentCombos(typeCombo);
  if (expanded.includes('*×*')) return true;
  return expanded.includes(profileCombo);
}

/**
 * 三元组精确匹配（3.1.4）
 * (attachmentCombo, conflictPattern, stage) 完全相等
 *
 * attachmentCombo 支持多组合与通配符：
 * - 'S×S' 精确匹配
 * - 'A×A|S×S' 匹配 A×A 或 S×S
 * - 'S/D×S/D' 匹配 4 种组合
 * - '*×*' 通配所有
 */
function matchByTuple(
  types: CoupleTypeInfo[],
  profile: CoupleProfile,
): CoupleTypeInfo | null {
  return (
    types.find(
      (t) =>
        attachmentComboMatches(t.attachmentCombo, profile.attachmentCombo) &&
        t.conflictPattern === profile.conflictPattern &&
        t.stage === profile.stage,
    ) || null
  );
}

/**
 * 相似度计算（欧氏距离 → 0-100 分）
 * 用 typeRadar 与双方维度均值对比，距离越小相似度越高。
 */
function similarityScore(
  typeRadar: DimensionScores,
  dimsA: DimensionScores,
  dimsB: DimensionScores,
): number {
  const dims: (keyof DimensionScores)[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
  let sumSq = 0;
  for (const d of dims) {
    const avg = (dimsA[d] + dimsB[d]) / 2;
    sumSq += Math.pow(typeRadar[d] - avg, 2);
  }
  const distance = Math.sqrt(sumSq);
  // 距离越小相似度越高，转换为 0-100 分
  return Math.max(0, 100 - distance);
}

/**
 * 无精确匹配时相似度回退（3.1.6）
 * 返回 top N 备选
 */
function fallbackBySimilarity(
  types: CoupleTypeInfo[],
  profile: CoupleProfile,
  n = 3,
): CoupleTypeInfo[] {
  const scored = types.map((t) => ({
    type: t,
    score: similarityScore(t.radarProfile, profile.dimensionsA, profile.dimensionsB),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((s) => s.type);
}

/**
 * 主匹配函数
 *
 * @param genderCombo 性别组合（决定类型库）
 * @param dimsA A 的 6 维度分数
 * @param dimsB B 的 6 维度分数
 * @param dominantStyleA A 在 D1 题组中占比最高的 attachment 标记（可选）
 * @param dominantStyleB B 在 D1 题组中占比最高的 attachment 标记（可选）
 * @param monthsTogether 在一起的月数（可选）
 * @returns TypeMatchResult
 */
export function matchCoupleType(
  genderCombo: GenderCombo,
  dimsA: DimensionScores,
  dimsB: DimensionScores,
  dominantStyleA?: AttachmentStyle,
  dominantStyleB?: AttachmentStyle,
  monthsTogether = 0,
): TypeMatchResult {
  // 1. 取该性别组合的类型库（3.1.5 性别组合触发类型库）
  const allTypes = getCoupleTypesByGenderCombo(genderCombo);

  // 2. 构建双方 CoupleProfile
  const profile = buildCoupleProfile(
    dimsA,
    dimsB,
    dominantStyleA,
    dominantStyleB,
    monthsTogether,
  );

  // 3. 三元组精确匹配（3.1.4）
  const matched = matchByTuple(allTypes, profile);

  // 4. 无精确匹配时相似度回退（3.1.6）
  if (!matched) {
    const top = fallbackBySimilarity(allTypes, profile, 3);
    if (top.length === 0) {
      // 类型库为空（不应发生），抛错由调用方兜底
      throw new Error('类型库为空：genderCombo=' + genderCombo);
    }
    return {
      matched: top[0],
      alternatives: top.slice(1, 3),
      compatibility: Math.round(
        similarityScore(top[0].radarProfile, dimsA, dimsB),
      ),
      summary: '', // Phase 3 暂不生成 AI summary
    };
  }

  // 5. 精确匹配：备选 = 排除自身后相似度 top 2
  const alternatives = fallbackBySimilarity(
    allTypes.filter((t) => t.code !== matched.code),
    profile,
    2,
  );

  return {
    matched,
    alternatives,
    compatibility: Math.round(
      similarityScore(matched.radarProfile, dimsA, dimsB),
    ),
    summary: '',
  };
}
