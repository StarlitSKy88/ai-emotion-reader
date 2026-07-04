/**
 * 问心 AI · 65 种情侣类型聚合导出
 * 30 常见 + 5 稀有 + 15 男男 + 15 女女 = 65
 */
import type { CoupleTypeInfo } from './types';
import { HETERO_COUPLE_TYPES } from './couple-types-hetero';
import { MALE_MALE_COUPLE_TYPES } from './couple-types-male-male';
import { FEMALE_FEMALE_COUPLE_TYPES } from './couple-types-female-female';

/** 全部 65 种类型 */
export const ALL_COUPLE_TYPES: CoupleTypeInfo[] = [
  ...HETERO_COUPLE_TYPES,
  ...MALE_MALE_COUPLE_TYPES,
  ...FEMALE_FEMALE_COUPLE_TYPES,
];

/** 按性别组合查询类型库 */
export function getCoupleTypesByGenderCombo(
  genderCombo: 'male-female' | 'male-male' | 'female-female'
): CoupleTypeInfo[] {
  return ALL_COUPLE_TYPES.filter((t) => t.genderCombo === genderCombo);
}

/** 按 code 查询单个类型 */
export function getCoupleTypeByCode(code: string): CoupleTypeInfo | undefined {
  return ALL_COUPLE_TYPES.find((t) => t.code === code);
}

/** 公共类型百科（isPublic=true 的 35 种） */
export const PUBLIC_COUPLE_TYPES: CoupleTypeInfo[] = ALL_COUPLE_TYPES.filter(
  (t) => t.isPublic
);

/** 稀有类型（5 种） */
export const RARE_COUPLE_TYPES: CoupleTypeInfo[] = ALL_COUPLE_TYPES.filter(
  (t) => t.rarity === 'rare'
);
