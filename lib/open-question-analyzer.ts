/**
 * 问心 AI · 开放题 LLM 分析器
 *
 * 分析用户对情侣关系开放题的回答，输出 3 个标签：
 * - emotion：情感浓度关键词
 * - attachment：依恋信号
 * - value：价值观倾向
 *
 * Phase 1 暂不在 submit 路由中调用（异步分析，Phase 2 配对完成后再调用），
 * 但需可被 import。
 *
 * B-PQ-2 修复：attachment 加 F 混乱型 + 枚举白名单约束，
 * emotion/value 加允许词表，解析层加 type guard 兜底。
 */
import { chatCompletion } from './llm';
import type { OpenAnswerAnalysis } from '@/shared/types';

/** 分析失败时的兜底返回 */
const FALLBACK: OpenAnswerAnalysis = {
  emotion: '未知',
  attachment: '未知',
  value: '未知',
};

/**
 * B-PQ-2：attachment 枚举白名单
 * S 安全型 / A 焦虑型 / D 回避型 / F 混乱型
 * 与 shared/type-matcher.ts 的 attachmentCombo 匹配保持一致（已支持 S/A/D/F）。
 */
const ALLOWED_ATTACHMENTS = ['S', 'A', 'D', 'F'] as const;
type AllowedAttachment = (typeof ALLOWED_ATTACHMENTS)[number];

/**
 * B-PQ-2：emotion 允许词表（10 词）
 * 温暖/焦虑/疏离/愤怒/无力/兴奋/麻木/委屈/悲伤/恐惧
 */
const ALLOWED_EMOTIONS = [
  '温暖',
  '焦虑',
  '疏离',
  '愤怒',
  '无力',
  '兴奋',
  '麻木',
  '委屈',
  '悲伤',
  '恐惧',
];

/**
 * B-PQ-2：value 允许词表（6 词）
 * 成长/安全/自由/归属/掌控/被理解
 */
const ALLOWED_VALUES = [
  '成长',
  '安全',
  '自由',
  '归属',
  '掌控',
  '被理解',
];

/**
 * 系统提示词
 *
 * B-PQ-2 修复：
 * - attachment 示例从「安全型/焦虑型/回避型」改为 S/A/D/F 单字母枚举，加 F 混乱型
 * - 加枚举白名单约束：attachment 必须输出 S/A/D/F 之一
 * - emotion / value 加允许词表约束
 */
const SYSTEM_PROMPT = `你是问心 AI 的开放题分析器。分析用户对情侣关系开放题的回答，输出 3 个标签：

1. emotion：情感浓度关键词，必须从以下词表中选一个：温暖/焦虑/疏离/愤怒/无力/兴奋/麻木/委屈/悲伤/恐惧
2. attachment：依恋信号，必须输出以下单个字母之一（不允许其他值）：
   - S 安全型
   - A 焦虑型
   - D 回避型
   - F 混乱型
3. value：价值观倾向，必须从以下词表中选一个：成长/安全/自由/归属/掌控/被理解

严格输出 JSON（不要 markdown 代码块、不要多余文字）：
{"emotion":"","attachment":"","value":""}`;

/**
 * B-PQ-2：attachment type guard
 * 非法值降级为 'D'（回避型，最安全默认——既不激化也不误判为健康）。
 */
function sanitizeAttachment(raw: unknown): AllowedAttachment {
  if (
    typeof raw === 'string' &&
    (ALLOWED_ATTACHMENTS as readonly string[]).includes(raw)
  ) {
    return raw as AllowedAttachment;
  }
  // 非法值降级为 D（回避型）
  return 'D';
}

/**
 * 分析开放题答案
 *
 * B-PQ-2 修复：解析层加 type guard。
 * - attachment 非法时降级为 'D'（回避型，最安全默认）
 * - emotion / value 不在允许词表时保留 LLM 原值但加 warn 日志，
 *   便于后续观测 LLM 偏离词表的频率（不强制降级，避免误伤合理同义词）。
 *
 * @param openAnswer 用户对开放题的回答文本
 * @returns 3 标签分析结果，失败时返回 { emotion: '未知', ... }
 */
export async function analyzeOpenAnswer(
  openAnswer: string,
): Promise<OpenAnswerAnalysis> {
  const userPrompt = `用户回答：${openAnswer}`;

  try {
    const raw = await chatCompletion(SYSTEM_PROMPT, userPrompt, 256);

    // 从 LLM 输出中提取 JSON（兼容模型可能附带多余文本的情况）
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ...FALLBACK, raw };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<OpenAnswerAnalysis>;

    // B-PQ-2：attachment 强制枚举约束，非法值降级为 D
    const attachment = sanitizeAttachment(parsed.attachment);

    // B-PQ-2：emotion 不在词表时保留原值 + 日志
    const emotion = parsed.emotion ?? '未知';
    if (emotion !== '未知' && !ALLOWED_EMOTIONS.includes(emotion)) {
      console.warn(
        `[B-PQ-2] open-question emotion 不在允许词表：${emotion}（保留原值）`,
      );
    }

    // B-PQ-2：value 不在词表时保留原值 + 日志
    const value = parsed.value ?? '未知';
    if (value !== '未知' && !ALLOWED_VALUES.includes(value)) {
      console.warn(
        `[B-PQ-2] open-question value 不在允许词表：${value}（保留原值）`,
      );
    }

    return {
      emotion,
      attachment,
      value,
      raw,
    };
  } catch {
    return FALLBACK;
  }
}
