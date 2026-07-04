/**
 * 问心 AI · 每日任务生成引擎（Phase 4.1 核心）
 *
 * 5 个原子点：
 * 4.1.1 7 维权重框架（weakness / emotionTrend / asymmetry / stage / streak / coupleType / randomness）
 * 4.1.2 维度短板定向生成（D2 低 → 沟通类任务）
 * 4.1.3 近期情绪模式识别（连续负面 → 情绪处理任务）
 * 4.1.4 不对称检测（一方昨日未完成 → 降难度 easy）
 * 4.1.5 fallback 预设任务库（LLM 失败时兜底）
 *
 * 设计原则：
 * - 本引擎只负责「选维度 + 选难度 + 提供兜底任务」，不直接调用 LLM
 * - LLM 调用由 API 路由层负责（lib/prompts.ts 构造 prompt + lib/llm.ts chatCompletion）
 * - LLM 失败时 API 路由用 pickFallbackTask 兜底，保证任务一定能生成
 */
import type {
  Dimension,
  DimensionScores,
  EmotionTrend,
  TaskCategory,
  TaskDifficulty,
  TaskGenerationInput,
  TaskWeightConfig,
} from '@/shared/types';

// ==================== 4.1.1 7 维权重框架 ====================

/**
 * 默认 7 维权重配置
 * 权重越高，该维度被选为目标维度的概率越大
 * 总和无需归一化，内部会按比例转换
 */
export const DEFAULT_TASK_WEIGHTS: TaskWeightConfig = {
  weakness: 0.3,      // 短板维度权重最高（核心定向逻辑）
  emotionTrend: 0.2,  // 近期情绪模式
  asymmetry: 0.1,     // 不对称检测（影响难度而非维度选择）
  stage: 0.1,         // 关系阶段
  streak: 0.1,        // 连续天数（避免重复）
  coupleType: 0.1,    // 类型风格
  randomness: 0.1,    // 随机性（保证多样性）
};

// ==================== 维度元信息 ====================

/** 维度中文名 */
export const DIMENSION_LABELS: Record<Dimension, string> = {
  D1: '依恋',
  D2: '沟通',
  D3: '冲突修复',
  D4: '共同意义',
  D5: '信任承诺',
  D6: '亲密激情',
};

/** 维度对应的任务分类（短板定向用） */
export const DIMENSION_TO_CATEGORY: Record<Dimension, TaskCategory> = {
  D1: 'self-awareness',
  D2: 'communication',
  D3: 'communication',
  D4: 'meaning',
  D5: 'relationship',
  D6: 'intimacy',
};

/** 维度顺序（用于遍历） */
const DIMENSIONS: Dimension[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

// ==================== 4.1.2 短板定向 ====================

/**
 * 找双方均分最低的维度（短板）
 * @returns 按均分升序排列的维度列表（[0] 为最低）
 */
export function rankDimensionsByWeakness(
  dimsA: DimensionScores,
  dimsB: DimensionScores,
): Dimension[] {
  return [...DIMENSIONS].sort((a, b) => {
    const avgA = (dimsA[a] + dimsB[a]) / 2;
    const avgB = (dimsA[b] + dimsB[b]) / 2;
    return avgA - avgB;
  });
}

/**
 * 关系阶段 → 推荐维度映射
 * - honeymoon（蜜月期）→ D6 亲密激情
 * - adjustment（调整期）→ D2 沟通
 * - stable（稳定期）→ D4 共同意义
 * - crisis（危机期）→ D3 冲突修复
 * - rebirth（重生期）→ D4 共同意义
 */
const STAGE_RECOMMENDATION: Record<string, Dimension> = {
  honeymoon: 'D6',
  adjustment: 'D2',
  stable: 'D4',
  crisis: 'D3',
  rebirth: 'D4',
};

// ==================== 4.1.3 情绪模式识别 ====================

/** 情绪趋势分析结果 */
export interface EmotionAnalysis {
  /** 是否连续负面（≥2 天 score < 0） */
  isConsecutiveNegative: boolean;
  /** 是否连续正面（≥2 天 score > 0） */
  isConsecutivePositive: boolean;
  /** 平均情绪分（-2 ~ 2） */
  avgScore: number;
  /** 数据天数 */
  days: number;
}

/**
 * 识别近期情绪模式
 * - 连续负面 → 建议情绪处理任务（D1 维度 + emotion 分类）
 * - 连续正面 → 可挑战更高难度（亲密/意义类）
 */
export function analyzeEmotionTrend(trend?: EmotionTrend[]): EmotionAnalysis {
  if (!trend || trend.length === 0) {
    return {
      isConsecutiveNegative: false,
      isConsecutivePositive: false,
      avgScore: 0,
      days: 0,
    };
  }

  const sorted = [...trend].sort((a, b) => a.date.localeCompare(b.date));
  const avgScore = sorted.reduce((s, t) => s + t.score, 0) / sorted.length;

  // 检查末尾连续负面
  let negStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].score < 0) negStreak++;
    else break;
  }
  // 检查末尾连续正面
  let posStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].score > 0) posStreak++;
    else break;
  }

  return {
    isConsecutiveNegative: negStreak >= 2,
    isConsecutivePositive: posStreak >= 2,
    avgScore,
    days: sorted.length,
  };
}

// ==================== 4.1.4 不对称检测 ====================

/** 不对称分析结果 */
export interface AsymmetryAnalysis {
  /** 是否存在不对称（一方昨日完成，另一方未完成） */
  isAsymmetric: boolean;
  /** 落后方是否是 A */
  aLagging: boolean;
  /** 落后方是否是 B */
  bLagging: boolean;
  /** 双方都未完成 */
  bothLagging: boolean;
}

/**
 * 检测双方完成情况的不对称
 * - 一方未完成 → 降难度（easy）+ 任务偏向「独立可完成」
 * - 双方都未完成 → 可能任务过难，进一步降难度 + 选不同维度
 */
export function analyzeAsymmetry(
  aCompletedYesterday: boolean,
  bCompletedYesterday: boolean,
): AsymmetryAnalysis {
  return {
    isAsymmetric: aCompletedYesterday !== bCompletedYesterday,
    aLagging: !aCompletedYesterday && bCompletedYesterday,
    bLagging: aCompletedYesterday && !bCompletedYesterday,
    bothLagging: !aCompletedYesterday && !bCompletedYesterday,
  };
}

// ==================== 4.1.1 权重框架主逻辑 ====================

/** 任务生成计划（API 路由据此调用 LLM 或 fallback） */
export interface TaskPlan {
  /** 任务来源维度（LLM prompt 的 sourceDimension） */
  sourceDimension: Dimension;
  /** 任务目标改善维度（LLM prompt 的 targetDimension） */
  targetDimension: Dimension;
  /** 推荐难度（LLM 失败时 fallback 也用此难度） */
  difficulty: TaskDifficulty;
  /** 任务分类（fallback 库筛选用） */
  category: TaskCategory;
  /** 是否调用 LLM 生成（连续天数 0 或异常场景可降级为纯 fallback） */
  useLLM: boolean;
  /** 兜底任务（LLM 失败时直接用） */
  fallbackTask: FallbackTask;
}

/**
 * 根据 7 维权重选择目标维度
 *
 * 权重框架实际参与决策：
 * - weakness 权重 → 短板维度得分（分数越低，得分越高）
 * - emotionTrend 权重 → D1 维度在连续负面时得分加成
 * - stage 权重 → 关系阶段推荐维度得分加成
 * - randomness 权重 → 随机扰动，保证多样性
 * - asymmetry 权重 → 当前不影响维度选择（仅影响难度），预留扩展
 * - streak 权重 → 当前不影响维度选择（通过 fallback 轮转体现），预留扩展
 * - coupleType 权重 → 当前不影响维度选择（需类型库支持），预留扩展
 *
 * @param input 任务生成输入
 * @param weights 权重配置（默认 DEFAULT_TASK_WEIGHTS）
 */
export function generateTaskPlan(
  input: TaskGenerationInput,
  weights: TaskWeightConfig = DEFAULT_TASK_WEIGHTS,
): TaskPlan {
  // 1. 情绪模式分析（强信号，可能覆盖短板）
  const emotionA = analyzeEmotionTrend(input.emotionTrendA);
  const emotionB = analyzeEmotionTrend(input.emotionTrendB);
  const anyConsecutiveNegative =
    emotionA.isConsecutiveNegative || emotionB.isConsecutiveNegative;

  // 2. 不对称分析（影响难度）
  const asymmetry = analyzeAsymmetry(
    input.aCompletedYesterday,
    input.bCompletedYesterday,
  );

  // 3. 关系阶段推荐维度
  const stageRecommendation = STAGE_RECOMMENDATION[input.stage];

  // 4. 按 7 维加权得分选目标维度
  // 每个维度计算综合得分，选得分最高的
  let bestDimension: Dimension = 'D1';
  let bestScore = -Infinity;
  for (const dim of DIMENSIONS) {
    // 短板信号：分数越低，信号越强（0-1）
    const avgScore = (input.dimensionsA[dim] + input.dimensionsB[dim]) / 2;
    const weaknessSignal = Math.max(0, 1 - avgScore / 100);

    // 情绪信号：仅 D1 在连续负面时为 1
    const emotionSignal = dim === 'D1' && anyConsecutiveNegative ? 1 : 0;

    // 阶段信号：推荐维度为 1
    const stageSignal = dim === stageRecommendation ? 1 : 0;

    // 随机信号：0-1
    const randomSignal = Math.random();

    // 综合得分（asymmetry/streak/coupleType 信号当前为 0，预留扩展）
    const score =
      weaknessSignal * weights.weakness +
      emotionSignal * weights.emotionTrend +
      0 * weights.asymmetry +
      stageSignal * weights.stage +
      0 * weights.streak +
      0 * weights.coupleType +
      randomSignal * weights.randomness;

    if (score > bestScore) {
      bestScore = score;
      bestDimension = dim;
    }
  }

  const targetDimension = bestDimension;
  const sourceDimension = targetDimension;
  // 连续负面 + D1 → emotion 分类；否则按维度默认分类
  const category: TaskCategory =
    targetDimension === 'D1' && anyConsecutiveNegative
      ? 'emotion'
      : DIMENSION_TO_CATEGORY[targetDimension];

  // 5. 选难度
  let difficulty: TaskDifficulty;
  if (asymmetry.bothLagging) {
    // 双方都未完成 → 任务太难，降 easy
    difficulty = 'easy';
  } else if (asymmetry.isAsymmetric) {
    // 一方未完成 → 降 easy（保证独立可完成）
    difficulty = 'easy';
  } else if (emotionA.isConsecutivePositive && emotionB.isConsecutivePositive) {
    // 双方都连续正面 → 可挑战 hard
    difficulty = 'hard';
  } else if (input.stage === 'honeymoon') {
    // 蜜月期 → easy（轻量起步）
    difficulty = 'easy';
  } else if (input.stage === 'crisis') {
    // 危机期 → easy（避免压力）
    difficulty = 'easy';
  } else {
    // 默认 medium
    difficulty = 'medium';
  }

  // 6. 选 fallback 任务（同维度 + 同难度，避免与最近重复）
  const fallbackTask = pickFallbackTask(
    targetDimension,
    difficulty,
    input.streakDays,
  );

  // 7. 是否用 LLM：始终用 LLM 生成更贴心的任务，失败时由 API 路由降级到 fallbackTask
  const useLLM = true;

  return {
    sourceDimension,
    targetDimension,
    difficulty,
    category,
    useLLM,
    fallbackTask,
  };
}

// ==================== 4.1.5 fallback 预设任务库 ====================

/** fallback 预设任务 */
export interface FallbackTask {
  title: string;
  description: string;
  difficulty: TaskDifficulty;
  sourceDimension: Dimension;
  targetDimension?: Dimension;
  estimatedMin: number;
  category: TaskCategory;
}

/**
 * fallback 预设任务库
 * 每个维度 + 每个难度各 2-3 个，避免短期内重复
 */
const FALLBACK_TASKS: Record<Dimension, FallbackTask[]> = {
  D1: [
    {
      title: '写下你今天最强烈的一个情绪',
      description:
        '花 3 分钟，写下你今天体验到的最强烈的一个情绪，以及触发它的事件。不需要发给对方，只是先看见自己。',
      difficulty: 'easy',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 3,
      category: 'self-awareness',
    },
    {
      title: '告诉对方一个你最近的「小不安」',
      description:
        '挑一个不严重但真实存在的小不安（比如「最近总担心工作出错」），用一句话告诉对方。不需要对方解决，只是分享。',
      difficulty: 'medium',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 5,
      category: 'emotion',
    },
    {
      title: '回忆一个让你觉得被爱的瞬间',
      description:
        '闭上眼回忆一个对方让你觉得被爱的具体瞬间（某句话、某个动作）。把它写下来，然后告诉对方「那天你那样做，我记得」。',
      difficulty: 'easy',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 3,
      category: 'emotion',
    },
    // V2 优化（W-4）：原 fallback 库缺 hard 难度，补充 hard 难度任务
    {
      title: '写一封「内在小孩」的信并分享给对方',
      description:
        '花 15 分钟写一封信给自己的「内在小孩」（童年那个感到不安的部分），告诉 TA 你现在如何理解 TA 的不安。写完挑一段你愿意的部分念给对方听，让 TA 看见你的脆弱。',
      difficulty: 'hard',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 15,
      category: 'self-awareness',
    },
  ],
  D2: [
    {
      title: '用「我感到…因为…」造一句话',
      description:
        '挑今天的一件小事，用「我感到___，因为___」的句式告诉对方。避免「你总是」「你从不」这类指责性开头。',
      difficulty: 'easy',
      sourceDimension: 'D2',
      targetDimension: 'D2',
      estimatedMin: 3,
      category: 'communication',
    },
    {
      title: '听完对方说话再回应',
      description:
        '今天和对方有一次对话时，练习「先完整听完对方说完，停顿 3 秒，再回应」。不插嘴、不预判、不急着给建议。',
      difficulty: 'medium',
      sourceDimension: 'D2',
      targetDimension: 'D2',
      estimatedMin: 5,
      category: 'communication',
    },
    {
      title: '问对方一个开放问题',
      description:
        '问对方一个没有标准答案的问题，比如「今天有什么让你意外的事吗？」然后认真听完答案。',
      difficulty: 'easy',
      sourceDimension: 'D2',
      targetDimension: 'D2',
      estimatedMin: 3,
      category: 'communication',
    },
    // V2 优化（W-4）：原 fallback 库缺 hard 难度，补充 hard 难度任务
    {
      title: '用「非暴力沟通」四步法聊一件近期的小摩擦',
      description:
        '挑近期一次小摩擦，用「观察 → 感受 → 需要 → 请求」四步完整写下来给对方看。例：「周二你没回我消息（观察），我感到有点失落（感受），因为我需要被放在心上（需要），下次能否在忙之前告诉我一声（请求）」。双方都做完后交换看。',
      difficulty: 'hard',
      sourceDimension: 'D2',
      targetDimension: 'D2',
      estimatedMin: 20,
      category: 'communication',
    },
  ],
  D3: [
    {
      title: '识别你们最近一次小摩擦的「引爆点」',
      description:
        '回想最近一次小摩擦，写下来：触发事件是什么？你当时的情绪是什么？对方可能是什么情绪？不评价对错，只是看见。',
      difficulty: 'medium',
      sourceDimension: 'D3',
      targetDimension: 'D3',
      estimatedMin: 5,
      category: 'communication',
    },
    {
      title: '主动说一句「刚才我也有点急」',
      description:
        '如果今天有小摩擦，主动说一句「刚才我也有点急，不是针对你」。如果今天没有，回忆上次摩擦时自己可以补充这句的话。',
      difficulty: 'easy',
      sourceDimension: 'D3',
      targetDimension: 'D3',
      estimatedMin: 3,
      category: 'communication',
    },
    {
      title: '约定一个「暂停手势」',
      description:
        '和对方约定一个手势（比如比 ✋），表示「我现在情绪有点上头，需要 10 分钟冷静」。双方都同意后用这个手势代替争吵。',
      difficulty: 'medium',
      sourceDimension: 'D3',
      targetDimension: 'D3',
      estimatedMin: 5,
      category: 'relationship',
    },
    // V2 优化（W-4）：原 fallback 库缺 hard 难度，补充 hard 难度任务
    {
      title: '复盘一次近期冲突并各自承担一部分责任',
      description:
        '挑近期一次较明显的冲突，各自独处 10 分钟写下：①我当时的情绪 ②我哪个举动可能激化了对方 ③如果重来一次我可以怎么改。写完后双方交换看，并各自说一句「这部分是我可以承担的」。',
      difficulty: 'hard',
      sourceDimension: 'D3',
      targetDimension: 'D3',
      estimatedMin: 25,
      category: 'communication',
    },
  ],
  D4: [
    {
      title: '一起回忆你们关系的起点',
      description:
        '和对方一起回忆你们第一次见面的场景。各自写下一句话：当时对方给你留下的第一印象是什么？',
      difficulty: 'easy',
      sourceDimension: 'D4',
      targetDimension: 'D4',
      estimatedMin: 5,
      category: 'meaning',
    },
    {
      title: '讨论一个共同的「小传统」',
      description:
        '和对方讨论一个你们已经有的小习惯（比如每周日一起看一集剧），或者约定一个新的小传统。把它写下来。',
      difficulty: 'medium',
      sourceDimension: 'D4',
      targetDimension: 'D4',
      estimatedMin: 7,
      category: 'meaning',
    },
    {
      title: '写下你们关系的「三个关键词」',
      description:
        '各自写下三个形容你们关系的关键词，然后交换看。如果不同，聊聊为什么。',
      difficulty: 'medium',
      sourceDimension: 'D4',
      targetDimension: 'D4',
      estimatedMin: 5,
      category: 'meaning',
    },
    // V2 优化（W-4）：原 fallback 库缺 hard 难度，补充 hard 难度任务
    {
      title: '共同写一份「关系愿景清单」',
      description:
        '和对方一起花 30 分钟，写一份未来一年的「关系愿景清单」：你们想一起完成的三件事、想成为怎样的一对、各自愿意为关系投入的一种小改变。写完各自保留一份，半年后拿出来看。',
      difficulty: 'hard',
      sourceDimension: 'D4',
      targetDimension: 'D4',
      estimatedMin: 30,
      category: 'meaning',
    },
  ],
  D5: [
    {
      title: '主动告诉对方一件「我相信你」的事',
      description:
        '主动告诉对方一件你相信 TA 能做好的事，比如「我相信你能搞定那个项目」。具体到事，不要泛泛而谈。',
      difficulty: 'easy',
      sourceDimension: 'D5',
      targetDimension: 'D5',
      estimatedMin: 3,
      category: 'relationship',
    },
    {
      title: '承诺一件本周会做的小事，并做到',
      description:
        '向对方承诺一件本周内会做的小事（比如「周三晚上洗碗」），设个提醒，按时完成。信任来自小事的累积。',
      difficulty: 'medium',
      sourceDimension: 'D5',
      targetDimension: 'D5',
      estimatedMin: 5,
      category: 'relationship',
    },
    {
      title: '聊聊你最近对关系的一个「小担心」',
      description:
        '用一个温和的方式，告诉对方你最近对关系的一个小担心（不是大问题，只是想说说）。比如「最近我们好像都挺忙的」。',
      difficulty: 'medium',
      sourceDimension: 'D5',
      targetDimension: 'D5',
      estimatedMin: 7,
      category: 'relationship',
    },
    // V2 优化（W-4）：原 fallback 库缺 hard 难度，补充 hard 难度任务
    {
      title: '共同做一份「信任重建」清单并各自承诺一项行动',
      description:
        '和对方各自写下：①最近一件让你们信任感动摇的小事 ②你希望对方在这件事上能做的一点改变 ③你自己也愿意为重建信任做的一件事。交换看后，各自挑一项本周内会做的行动告诉对方。',
      difficulty: 'hard',
      sourceDimension: 'D5',
      targetDimension: 'D5',
      estimatedMin: 25,
      category: 'relationship',
    },
  ],
  D6: [
    {
      title: '主动给对方一个 20 秒的拥抱',
      description:
        '今天主动给对方一个长一点的拥抱（至少 20 秒），不发一言，只是抱。长拥抱会释放催产素，比短拥抱更拉近关系。',
      difficulty: 'easy',
      sourceDimension: 'D6',
      targetDimension: 'D6',
      estimatedMin: 1,
      category: 'intimacy',
    },
    {
      title: '一起做一件「无用但有趣」的小事',
      description:
        '和对方一起做一件没有目的的小事，比如一起看 5 分钟云、一起拼一个奇怪的图、一起回忆一部老片。重点是「一起」而不是「做什么」。',
      difficulty: 'medium',
      sourceDimension: 'D6',
      targetDimension: 'D6',
      estimatedMin: 10,
      category: 'intimacy',
    },
    {
      title: '告诉对方一个 TA 让你心动的瞬间',
      description:
        '告诉对方一个最近让 TA 你心动的具体瞬间（某个表情、某句话、某个动作）。具体到细节。',
      difficulty: 'easy',
      sourceDimension: 'D6',
      targetDimension: 'D6',
      estimatedMin: 3,
      category: 'intimacy',
    },
    // V2 优化（W-4）：原 fallback 库缺 hard 难度，补充 hard 难度任务
    {
      title: '一起完成一次「无手机 90 分钟」深度共处',
      description:
        '约一次 90 分钟的「无手机时段」：双方把手机调飞行模式放另一个房间。一起做一件需要专注共同完成的事（做饭、散步、拼图、长聊近况），期间不刷手机、不回消息。结束后各自写下一句「这 90 分钟里我最享受的瞬间」。',
      difficulty: 'hard',
      sourceDimension: 'D6',
      targetDimension: 'D6',
      estimatedMin: 90,
      category: 'intimacy',
    },
  ],
};

/**
 * 从 fallback 库选任务
 * - 优先匹配同维度 + 同难度
 * - 用 streakDays 做轮转（避免短期内重复）
 *
 * @param dimension 目标维度
 * @param difficulty 期望难度
 * @param streakDays 已连续生成天数（用于轮转）
 */
export function pickFallbackTask(
  dimension: Dimension,
  difficulty: TaskDifficulty,
  streakDays: number,
): FallbackTask {
  const pool = FALLBACK_TASKS[dimension];

  // 优先匹配同难度
  const sameDifficulty = pool.filter((t) => t.difficulty === difficulty);
  const candidates = sameDifficulty.length > 0 ? sameDifficulty : pool;

  // 用 streakDays 轮转，避免重复
  const index = streakDays % candidates.length;
  return candidates[index];
}

/** 获取 fallback 任务库（导出供测试或调试用） */
export function getAllFallbackTasks(): Record<Dimension, FallbackTask[]> {
  return FALLBACK_TASKS;
}
