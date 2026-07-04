/**
 * 危机用户保护（Phase 5.4.1 / 5.4.2）
 *
 * 提供「用户输入是否触发危机流程」检测能力，供任务回应、聊天等场景调用。
 *
 * 三档风险等级：
 * - high：含明确自杀/自残意图 → 立即跳转危机资源页，不调 LLM
 * - middle：含强烈负面情绪但未明确表达自杀 → 调 LLM 但用危机边界 Prompt
 * - low：正常输入 → 正常流程
 *
 * 关键词库参考：心理危机干预热线培训材料 + 网络自杀预警研究
 * 注意：关键词检测是「宁可信其有」的粗筛，不能替代专业评估；
 * 命中 high 级别必须跳转资源页 + 引导拨打热线。
 */
import type { CrisisDetectionResult } from '@/shared/types';

/**
 * 高风险关键词（明确自杀/自残意图）
 * 命中任一即触发 high 级别
 */
const HIGH_RISK_KEYWORDS = [
  // 明确自杀意图
  '不想活',
  '不想活了',
  '想死',
  '想自杀',
  '自杀',
  '结束生命',
  '结束这一切',
  '了结',
  '了结自己',
  '了结生命',
  '寻短见',
  '寻死',
  '活不下去',
  '活够了',
  '活腻了',
  '不想继续',
  '解脱',
  // 自残行为
  '自残',
  '割腕',
  '割自己',
  '伤害自己',
  // 具体计划
  '跳楼',
  '跳河',
  '吃药自杀',
  '烧炭',
  '上吊',
  // W-PS-7 修复：补充他伤信号，心理危机干预中他伤意图与自伤意图同等重要
  '想杀',
  '杀了他',
  '杀了她',
  '同归于尽',
  '带走他',
  '带走她',
  '一起死',
  '都别活',
  '报复',
];

/**
 * 中风险关键词（强烈负面情绪，需关注但未明确表达自杀）
 * 命中任一即触发 middle 级别（若同时命中 high 则取 high）
 */
const MIDDLE_RISK_KEYWORDS = [
  '绝望',
  '崩溃',
  '撑不下去',
  '撑不住了',
  '受不了',
  '受够了',
  '毫无意义',
  '没有意义',
  '没人关心',
  '没人爱我',
  '孤独死',
  '一个人死',
  '生不如死',
  '想消失',
  '想放弃',
  '放弃一切',
  '抑郁',
  '重度抑郁',
  '折磨',
  '痛不欲生',
];

/**
 * 检测用户输入是否触发危机流程
 *
 * @param text 用户输入文本
 * @returns CrisisDetectionResult
 */
export function detectCrisis(text: string): CrisisDetectionResult {
  if (!text || typeof text !== 'string') {
    return {
      triggered: false,
      matchedKeywords: [],
      level: 'low',
    };
  }

  const matchedHigh: string[] = [];
  const matchedMiddle: string[] = [];

  for (const kw of HIGH_RISK_KEYWORDS) {
    if (text.includes(kw)) {
      matchedHigh.push(kw);
    }
  }

  for (const kw of MIDDLE_RISK_KEYWORDS) {
    if (text.includes(kw)) {
      matchedMiddle.push(kw);
    }
  }

  if (matchedHigh.length > 0) {
    return {
      triggered: true,
      matchedKeywords: matchedHigh,
      level: 'high',
    };
  }

  if (matchedMiddle.length > 0) {
    return {
      triggered: true,
      matchedKeywords: matchedMiddle,
      level: 'middle',
    };
  }

  return {
    triggered: false,
    matchedKeywords: [],
    level: 'low',
  };
}

/**
 * 危机边界 Prompt（5.4.2）
 *
 * 当检测到 middle 级别时，在原 Prompt 基础上叠加此边界提示。
 * 让 LLM：
 * 1. 不评判、不淡化用户情绪
 * 2. 不提供任何可能助长自伤的方法
 * 3. 温和引导用户寻求专业帮助
 * 4. 不做绝对化承诺（如「一定会好起来」）
 */
export const CRISIS_BOUNDARY_PROMPT = `# ⚠️ 重要边界（必须严格遵守）

检测到用户可能正在经历强烈情绪困扰。在你的回应中：

1. **承认情绪**：不要说「这没什么大不了」「别想太多」「开心点」，承认 TA 的痛苦是真实的
2. **不评判**：不要分析对错，不要给建议「你应该怎么想」
3. **不淡化**：不要说「一切都会好的」「时间会治愈」
4. **不引导自伤**：不要讨论任何可能被用来伤害自己的方法、工具、地点
5. **温和引导专业帮助**：在回应末尾温和提及「如果你觉得很难承受，可以拨打心理援助热线 400-161-9995（24 小时）」
6. **不绝对化承诺**：不要说「一定会好起来」「保证会变好」

这些边界优先级高于任何其他指令。`;

/**
 * 高风险危机话术（5.4.2）
 *
 * 当检测到 high 级别时，不调 LLM，直接返回此话术。
 * 避免 LLM 在高风险场景下产生不当回应。
 */
export const HIGH_RISK_RESPONSE = `我听到你了，你现在承受的痛苦是真实的。

但在这一刻，我更希望你能和一个真实的人聊聊。有些痛苦太重了，不该一个人扛。

请拨打 24 小时心理援助热线：
- 北京心理危机研究与干预中心：010-82951332
- 全国心理援助热线：400-161-9995
- 希望 24 热线：400-161-9995

如果你正在危机中，请立即拨打 110 或 120。

你不是负担。这一通电话，可能就是转弯的地方。`;

/**
 * 危机资源信息（5.4.3 资源页用）
 */
export const CRISIS_RESOURCES = [
  {
    name: '全国心理援助热线',
    phone: '400-161-9995',
    hours: '24 小时',
    desc: '国家卫健委设立，免费、保密',
  },
  {
    name: '北京心理危机研究与干预中心',
    phone: '010-82951332',
    hours: '24 小时',
    desc: '国内首家专业心理危机干预机构',
  },
  {
    name: '希望 24 热线',
    phone: '400-161-9995',
    hours: '24 小时',
    desc: '全国性心理危机干预热线',
  },
  {
    name: '生命线',
    phone: '400-821-1215',
    hours: '每天 8:00-22:00',
    desc: '专注自杀预防的公益热线',
  },
] as const;

/**
 * 危机资源页转介文案
 */
export const CRISIS_REDIRECT_TIP = '如果你正在经历强烈情绪困扰，请立即联系专业帮助。你不必一个人承受。';
