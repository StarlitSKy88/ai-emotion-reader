/**
 * 问心 AI · 题干代词动态替换
 *
 * 题库题干已硬编码「他/她」（男版用「她」，女版用「他」）。
 * 同性恋场景下应显示「TA」而非「他/她」。
 * 替换发生在前端渲染时，不修改题库源数据。
 */
import type { GenderCombo, Question } from './types';

/** 代词替换规则 */
export type PronounStyle = 'mixed' | 'neutral';
// mixed: 保留原题库的他/她（异性恋场景）
// neutral: 替换为 TA（同性恋场景）

/** 根据性别组合判断代词风格 */
export function getPronounStyle(combo: GenderCombo): PronounStyle {
  return combo === 'male-female' ? 'mixed' : 'neutral';
}

/** 替换题干中的代词 */
export function replacePronounInStem(stem: string, style: PronounStyle): string {
  if (style === 'mixed') return stem;
  // neutral：把他/她替换为 TA，他的/她的→TA的，他/她（句中）→TA
  // 注意：用负向先行断言 (?!们) 排除「他们/她们」，避免误伤
  return stem
    .replace(/他的/g, 'TA的')
    .replace(/她的/g, 'TA的')
    .replace(/他(?!们)/g, 'TA')
    .replace(/她(?!们)/g, 'TA');
}

/** 替换整个题目的题干（返回新对象，不改原数据） */
export function replacePronounInQuestion(q: Question, style: PronounStyle): Question {
  return {
    ...q,
    stem: replacePronounInStem(q.stem, style),
    options: q.options.map((opt) => ({
      ...opt,
      text: replacePronounInStem(opt.text, style),
    })),
  };
}

/** 替换整个题库 */
export function replacePronounInBank(questions: Question[], style: PronounStyle): Question[] {
  return questions.map((q) => replacePronounInQuestion(q, style));
}
