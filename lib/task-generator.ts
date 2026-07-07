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
      title: '一起完成一次3分钟眼神对话',
      description:
        '面对面坐下，不看手机不说话，只看对方的眼睛3分钟。结束后各说一句刚才的感受。这是最简单的"在一起"。',
      difficulty: 'easy',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 3,
      category: 'self-awareness',
    },
    {
      title: '一起听一首对你们有特殊意义的歌',
      description:
        '找一首你们都喜欢的歌，戴上耳机或外放，一起完整听完。结束后各自写下一句听歌时想到的画面。',
      difficulty: 'easy',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 5,
      category: 'emotion',
    },
    {
      title: '一起给对方写一张"今天我注意到你"小纸条',
      description:
        '花3分钟，各自写下一句今天注意到对方的细节（"你今天笑起来有点累"）。写完交换看，不解释，只接住。',
      difficulty: 'medium',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 5,
      category: 'emotion',
    },
    {
      title: '一起完成15分钟同步呼吸练习',
      description:
        '背靠背坐下，闭上眼，一起呼吸15分钟。感受对方的呼吸节奏，试着同步。结束后不说话，各自写一句感受。',
      difficulty: 'hard',
      sourceDimension: 'D1',
      targetDimension: 'D1',
      estimatedMin: 15,
      category: 'self-awareness',
    },
  ],
  D2: [
    {
      title: '一起玩"3真1假"游戏',
      description:
        '各说4件关于自己的事（3件真的1件假的），对方猜哪件是假的。猜完后一起聊聊那些"真"的事。',
      difficulty: 'easy',
      sourceDimension: 'D2',
      targetDimension: 'D2',
      estimatedMin: 5,
      category: 'communication',
    },
    {
      title: '一起给对方讲今天最有意思的事',
      description:
        '各自花3分钟，给对方讲今天自己遇到的最有意思的一件事。对方只能听，不能评论，不能打断，听完只说"谢谢你告诉我"。',
      difficulty: 'medium',
      sourceDimension: 'D2',
      targetDimension: 'D2',
      estimatedMin: 6,
      category: 'communication',
    },
    {
      title: '一起完成一次"无声晚餐"',
      description:
        '一起吃一顿饭，全程不说话，只用眼神和手势交流。观察对方，感受对方，把注意力还给"在一起"本身。',
      difficulty: 'medium',
      sourceDimension: 'D2',
      targetDimension: 'D2',
      estimatedMin: 15,
      category: 'communication',
    },
    {
      title: '一起完成一次"角色互换对话"',
      description:
        '花10分钟，A扮演B，B扮演A，聊一件最近的小事。试着用对方的语气、对方的立场说话。结束后聊聊"原来你是这么想的"。',
      difficulty: 'hard',
      sourceDimension: 'D2',
      targetDimension: 'D2',
      estimatedMin: 10,
      category: 'communication',
    },
  ],
  D3: [
    {
      title: '一起做一次"和好仪式"',
      description:
        '为最近的一次小摩擦，双方各写一句"我做得不够好的地方"。写完一起把纸条撕掉，说一句"翻篇了"。',
      difficulty: 'easy',
      sourceDimension: 'D3',
      targetDimension: 'D3',
      estimatedMin: 5,
      category: 'relationship',
    },
    {
      title: '一起完成"情绪温度计"',
      description:
        '各自给今天的情绪打分（0-10分），写在纸上一起看。如果分差大，低分的一方说一句需要什么；如果分差小，互相击掌。',
      difficulty: 'easy',
      sourceDimension: 'D3',
      targetDimension: 'D3',
      estimatedMin: 3,
      category: 'communication',
    },
    {
      title: '一起完成"拥抱和解"',
      description:
        '为最近的一次小摩擦，给对方一个长拥抱（至少30秒），抱的时候说一句"我们和好了"。不解释，不翻旧账，只拥抱。',
      difficulty: 'medium',
      sourceDimension: 'D3',
      targetDimension: 'D3',
      estimatedMin: 1,
      category: 'relationship',
    },
    {
      title: '一起写一张"我们的停战协议"',
      description:
        '一起写下一句话："下次再有摩擦，我们先做____再说话"（比如先喝口水、先深呼吸3次）。双方共同签字，贴在冰箱上。',
      difficulty: 'hard',
      sourceDimension: 'D3',
      targetDimension: 'D3',
      estimatedMin: 10,
      category: 'relationship',
    },
  ],
  D4: [
    {
      title: '一起回忆你们第一次见面的场景',
      description:
        '坐在一起，轮流讲你们第一次见面时记得的细节。讲完后各自写下一句话："当时没想到你会..."。一起看对方写的。',
      difficulty: 'easy',
      sourceDimension: 'D4',
      targetDimension: 'D4',
      estimatedMin: 5,
      category: 'meaning',
    },
    {
      title: '一起画一张"我们的关系地图"',
      description:
        '拿一张纸，一起标出你们去过的地方、想一起去的地方。各自用不同颜色的笔画，最后一起给地图起个名字。',
      difficulty: 'medium',
      sourceDimension: 'D4',
      targetDimension: 'D4',
      estimatedMin: 15,
      category: 'meaning',
    },
    {
      title: '一起看一部电影',
      description:
        '选一部你们都想看（或重温）的电影，一起完整看完。结束后各自写一句观后感，交换看。重点是"一起看完"，不快进不分心。',
      difficulty: 'medium',
      sourceDimension: 'D4',
      targetDimension: 'D4',
      estimatedMin: 90,
      category: 'meaning',
    },
    {
      title: '一起完成"关系时间胶囊"',
      description:
        '各自写一封给一年后对方的信，封进信封，约定明年今日一起拆开。写的时候不放音乐不分心，只写给彼此的话。',
      difficulty: 'hard',
      sourceDimension: 'D4',
      targetDimension: 'D4',
      estimatedMin: 20,
      category: 'meaning',
    },
  ],
  D5: [
    {
      title: '一起完成一次"盲导信任走"',
      description:
        '一人闭眼，另一人引导走一段路（5分钟）。引导方只用手势和简短语言，确保对方安全。走完交换角色。',
      difficulty: 'easy',
      sourceDimension: 'D5',
      targetDimension: 'D5',
      estimatedMin: 5,
      category: 'relationship',
    },
    {
      title: '一起做一件对方一直想让你做的小事',
      description:
        'A陪B做一件B一直想让A做的事（看一集剧、吃一家店），B也陪A做一件A想做的事。一起完成，不分心。',
      difficulty: 'easy',
      sourceDimension: 'D5',
      targetDimension: 'D5',
      estimatedMin: 10,
      category: 'relationship',
    },
    {
      title: '一起制定"本月承诺清单"',
      description:
        '一起各写2件本月会为对方做的事（"周三晚上我洗碗"、"周末陪你逛街"）。写完一起念一遍，贴在冰箱上。',
      difficulty: 'medium',
      sourceDimension: 'D5',
      targetDimension: 'D5',
      estimatedMin: 10,
      category: 'relationship',
    },
    {
      title: '一起做一件对方擅长而你不会的事',
      description:
        '让擅长的一方教不擅长的一方做一件事（做饭、画画、运动）。一起完成，不评价对方学得怎么样，只说"谢谢你教我"。',
      difficulty: 'hard',
      sourceDimension: 'D5',
      targetDimension: 'D5',
      estimatedMin: 20,
      category: 'relationship',
    },
  ],
  D6: [
    {
      title: '一起给对方一个20秒拥抱',
      description:
        '今天主动给对方一个长拥抱（至少20秒），不发一言，只是抱。长拥抱会释放催产素，比短拥抱更拉近关系。',
      difficulty: 'easy',
      sourceDimension: 'D6',
      targetDimension: 'D6',
      estimatedMin: 1,
      category: 'intimacy',
    },
    {
      title: '一起跳一支舞',
      description:
        '在客厅放一首你们喜欢的歌，一起跳一支舞。不会跳没关系，抱着晃就行。重点是"一起动起来"。',
      difficulty: 'easy',
      sourceDimension: 'D6',
      targetDimension: 'D6',
      estimatedMin: 5,
      category: 'intimacy',
    },
    {
      title: '一起完成"心动留言"',
      description:
        '各自在对方手机备忘录留一句"今天我最心动你的瞬间"。留完一起看对方写的，再说一句"原来你是这么想的"。',
      difficulty: 'medium',
      sourceDimension: 'D6',
      targetDimension: 'D6',
      estimatedMin: 5,
      category: 'intimacy',
    },
    {
      title: '一起完成一次"无手机90分钟"深度共处',
      description:
        '双方把手机调飞行模式放另一个房间。一起做一件需要专注共同完成的事（拼图、做饭、散步），结束后各自写下一句最享受的瞬间。',
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
