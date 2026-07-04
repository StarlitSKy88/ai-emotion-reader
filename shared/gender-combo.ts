/**
 * 问心 AI · 性别组合判断函数
 *
 * 根据双方性别计算性别组合（决定类型库与题库版本）。
 * 顺序无关：male + female 等价于 female + male。
 *
 * 产品只支持三种组合：male-female / male-male / female-female。
 * 含 'other' 时抛错。
 */
import type { Gender, GenderCombo } from './types';

/**
 * 计算双方性别组合
 *
 * @param genderA A 的性别
 * @param genderB B 的性别
 * @returns 性别组合 'male-female' | 'male-male' | 'female-female'
 * @throws {Error} 当任一性别为 'other' 或非预期值时抛错
 */
export function getGenderCombo(genderA: Gender, genderB: Gender): GenderCombo {
  // 排序后拼接，使顺序无关
  const pair = [genderA, genderB].sort().join('-');

  switch (pair) {
    case 'female-male':
      return 'male-female';
    case 'male-male':
      return 'male-male';
    case 'female-female':
      return 'female-female';
    default:
      throw new Error(`不支持的性别组合：${genderA} + ${genderB}（仅支持 male / female）`);
  }
}
