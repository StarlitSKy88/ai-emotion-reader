/**
 * 开放题候选库（10 道）
 * 每对 couple 随机抽 1 道，A 和 B 拿到同一道
 * 3 约束：① 同 couple 同题 ② 10 题统一考察 3 维度 ③ 30 天内重测复用同题
 */
import type { OpenQuestion } from './types';

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    id: 'OPEN-1',
    stem: '用一段话描述你们关系里最让你心动的瞬间',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-2',
    stem: '如果你们关系是一部电影，片名是什么？为什么',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-3',
    stem: '你最害怕在这段关系里失去什么',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-4',
    stem: '用 3 个比喻形容你们的关系',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-5',
    stem: '你觉得 TA 最像什么动物？为什么',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-6',
    stem: '如果你们 80 岁还在一起，你希望 TA 记得你什么',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-7',
    stem: '你们吵得最凶那次，你心里真正想说的是什么',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-8',
    stem: '你从来没告诉过 TA，但希望 TA 知道的一件事',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-9',
    stem: '你觉得 TA 爱你哪一点？你自己觉得呢',
    targets: ['emotion', 'attachment', 'value'],
  },
  {
    id: 'OPEN-10',
    stem: '如果只能留一个关于你们的记忆，你留哪个',
    targets: ['emotion', 'attachment', 'value'],
  },
];

/**
 * 从开放题库抽 1 道
 *
 * 3 约束实现：
 * 1. 同 couple 同题：调用方在 PairSession 中存储 openQuestionId，A 和 B 复用同一 id
 *    （本函数不负责跨 couple 一致性，由 PairSession 业务层保证）
 * 2. 3 维度统一：所有 10 题的 targets 都是 ['emotion', 'attachment', 'value']，已在数据层保证
 * 3. 30 天内同用户重测复用同题：调用方传入 preferId（上次抽中的题），本函数优先返回
 *
 * @param preferId 优先返回的题目 ID（30 天内重测复用场景）
 * @param excludeIds 需排除的题目 ID（一般传空数组）
 */
export function pickOpenQuestion(
  preferId?: string,
  excludeIds: string[] = []
): OpenQuestion {
  // 约束 3：优先返回上次的题（30 天内重测复用）
  if (preferId) {
    const preferred = OPEN_QUESTIONS.find((q) => q.id === preferId);
    if (preferred) return preferred;
  }

  // 随机抽取
  const pool = OPEN_QUESTIONS.filter((q) => !excludeIds.includes(q.id));
  const candidates = pool.length > 0 ? pool : OPEN_QUESTIONS;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}

/**
 * 为新 couple 首次抽题（无 preferId，纯随机）
 */
export function pickOpenQuestionForNewCouple(): OpenQuestion {
  const idx = Math.floor(Math.random() * OPEN_QUESTIONS.length);
  return OPEN_QUESTIONS[idx];
}
