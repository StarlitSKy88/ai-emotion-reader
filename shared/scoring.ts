/**
 * 问心 AI · 评分引擎
 * - 维度归一化到 0-100
 * - 跳题处理：跳过 = 0 分并标记 incomplete
 * - 版本兼容：bankVersion 不匹配时强制重测
 */
import type {
  Answers,
  Dimension,
  DimensionScores,
  Question,
  TestBank,
} from './types';

/** 6 维度代号 */
const DIMENSIONS: Dimension[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

/** 评分结果 */
export interface ScoringResult {
  /** 各维度归一化分数 0-100 */
  scores: DimensionScores;
  /** 是否有跳题（数据不完整） */
  incomplete: boolean;
  /** 跳过的题目 ID 列表 */
  skippedQuestions: string[];
  /** 题库版本是否匹配 */
  versionMismatch: boolean;
}

/**
 * 计算单维度满分（用于归一化）
 * 满分 = 该维度所有题目的最大可能得分之和
 */
function getDimensionMaxScore(testBank: TestBank, dimension: Dimension): number {
  return testBank.questions
    .filter((q) => {
      // 该题至少有一个选项给该维度加分
      if (q.dimension !== dimension && q.dimension !== 'funny') return false;
      return q.options.some((opt) => (opt.scoring[dimension] ?? 0) > 0);
    })
    .reduce((sum, q) => {
      // 该题在该维度上的最大可得分
      const maxOpt = Math.max(
        ...q.options.map((opt) => opt.scoring[dimension] ?? 0)
      );
      return sum + maxOpt;
    }, 0);
}

/**
 * 计算单人的 6 维度归一化分数
 *
 * @param answers 用户答案 { "M-Q1": "A", "M-Q2": "B", ... }
 * @param testBank 对应性别的题库
 * @param expectedBankVersion 期望的题库版本（可选，用于版本校验）
 *
 * 归一化策略：维度得分 / 维度满分 × 100
 * 跳题策略：跳过的题 = 0 分，标记 incomplete=true
 */
export function calculateDimensionScores(
  answers: Answers,
  testBank: TestBank,
  expectedBankVersion?: string
): ScoringResult {
  // 版本校验
  const versionMismatch =
    expectedBankVersion !== undefined &&
    testBank.version !== expectedBankVersion;

  // 初始化各维度原始分
  const rawScores: Record<Dimension, number> = {
    D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0,
  };
  const skippedQuestions: string[] = [];

  // 遍历题库每道题，累加用户得分
  for (const question of testBank.questions) {
    const userChoice = answers[question.id];

    if (userChoice === undefined) {
      // 跳题：记 0 分
      skippedQuestions.push(question.id);
      continue;
    }

    const option = question.options.find((opt) => opt.label === userChoice);
    if (!option) continue; // 无效选项，跳过

    // 累加该选项对各维度的加分
    for (const dim of DIMENSIONS) {
      const score = option.scoring[dim];
      if (typeof score === 'number') {
        rawScores[dim] += score;
      }
    }
  }

  // 归一化到 0-100
  const scores: DimensionScores = {
    D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0,
  };

  for (const dim of DIMENSIONS) {
    const maxScore = getDimensionMaxScore(testBank, dim);
    scores[dim] = maxScore > 0 ? Math.round((rawScores[dim] / maxScore) * 100) : 0;
  }

  return {
    scores,
    incomplete: skippedQuestions.length > 0,
    skippedQuestions,
    versionMismatch,
  };
}

/**
 * 计算双人默契度（0-100）
 *
 * 默契度定义：双方在 6 维度上的「健康方向一致性」
 * - 同一维度双方分差越小 → 默契度越高
 * - 双方维度分都高 → 加分（同向且高）
 *
 * @param scoresA A 的维度分
 * @param scoresB B 的维度分
 * @returns 默契度 0-100
 */
export function calculateCompatibility(
  scoresA: DimensionScores,
  scoresB: DimensionScores
): number {
  let totalDiff = 0;
  let totalAvg = 0;

  for (const dim of DIMENSIONS) {
    const a = scoresA[dim];
    const b = scoresB[dim];
    totalDiff += Math.abs(a - b);       // 分差越小越默契
    totalAvg += (a + b) / 2;            // 平均分越高越健康
  }

  // 分差平均：0-100，0 表示完全一致，100 表示完全相反
  const avgDiff = totalDiff / DIMENSIONS.length;
  // 平均分：0-100，100 表示双方都满分
  const avgScore = totalAvg / DIMENSIONS.length;

  // 默契度 = 一致性权重 0.6 + 健康度权重 0.4
  const consistencyScore = 100 - avgDiff;
  const compatibility = Math.round(consistencyScore * 0.6 + avgScore * 0.4);

  return Math.max(0, Math.min(100, compatibility));
}

/**
 * 获取单题在某维度上的最大可得分（用于调试/展示）
 */
export function getQuestionMaxScore(
  question: Question,
  dimension: Dimension
): number {
  return Math.max(
    ...question.options.map((opt) => opt.scoring[dimension] ?? 0)
  );
}

/**
 * 获取题库每个维度的满分（用于展示/调试）
 */
export function getTestBankMaxScores(testBank: TestBank): DimensionScores {
  const result: DimensionScores = {
    D1: 0, D2: 0, D3: 0, D4: 0, D5: 0, D6: 0,
  };
  for (const dim of DIMENSIONS) {
    result[dim] = getDimensionMaxScore(testBank, dim);
  }
  return result;
}
