/**
 * 问心 AI · 情侣匹配测试 · 共享类型定义
 * 前后端通用，确保数据结构一致
 */

// ==================== 基础枚举 ====================

/** 性别 */
export type Gender = 'male' | 'female' | 'other';

/** 性别组合（决定题库版本与类型库） */
export type GenderCombo = 'male-female' | 'male-male' | 'female-female';

/** 6 维度代号 */
export type Dimension = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6';

/** 题目类型 */
export type QuestionKind = 'scale' | 'funny' | 'open';

/** 选项标签 */
export type OptionLabel = 'A' | 'B' | 'C' | 'D';

/** 依恋风格 */
export type AttachmentStyle = 'S' | 'A' | 'D' | 'F'; // 安全/焦虑/回避/混乱

/** 冲突模式 */
export type ConflictPattern =
  | 'pursue-pursue'
  | 'pursue-withdraw'
  | 'withdraw-pursue'
  | 'withdraw-withdraw'
  | 'repair';

/** 关系阶段 */
export type RelationshipStage = 'honeymoon' | 'adjustment' | 'stable' | 'crisis' | 'rebirth';

/** 类型稀有度 */
export type Rarity = 'common' | 'rare';

// ==================== 题库结构 ====================

/** 单个选项 */
export interface QuestionOption {
  label: OptionLabel;
  text: string;
  /** 该选项对各维度的加分 */
  scoring: Partial<Record<Dimension, number>>;
  /** 依恋风格标记（D1 题用） */
  attachment?: AttachmentStyle;
}

/** 单道题目 */
export interface Question {
  /** 题目 ID：M-Q1（男版）/ F-Q1（女版）/ OPEN-1（开放题库） */
  id: string;
  /** 所属维度 */
  dimension: Dimension | 'funny' | 'open';
  /** 题目类型 */
  kind: QuestionKind;
  /** 题干 */
  stem: string;
  /** 选项（开放题为空） */
  options: QuestionOption[];
  /** 无厘头题标记 */
  isFunny?: boolean;
  /** 开放题标记 */
  isOpen?: boolean;
  /** 心理学依据（评审用，seed 可选） */
  rationale?: string;
}

/** 题库 */
export interface TestBank {
  gender: Gender;
  version: string;
  questions: Question[];
}

// ==================== 开放题库 ====================

/** 开放题候选（10 道，每对 couple 随机抽 1） */
export interface OpenQuestion {
  id: string; // OPEN-1 ~ OPEN-10
  stem: string;
  /** 考察维度（统一 3 标签） */
  targets: ['emotion', 'attachment', 'value'];
}

// ==================== 维度分数 ====================

/** 6 维度分数 */
export type DimensionScores = Record<Dimension, number>;

/** 开放题 LLM 分析结果（3 标签） */
export interface OpenAnswerAnalysis {
  emotion: string;       // 情感浓度关键词
  attachment: string;    // 依恋信号
  value: string;         // 价值观倾向
  raw?: string;          // LLM 原始输出
}

// ==================== 测试会话 ====================

/** TestSession 的答案映射 */
export type Answers = Record<string, OptionLabel>; // { "M-Q1": "A", "M-Q2": "B", ... }

/** 含版本的答案包（用于题库升级时的兼容性判断） */
export interface AnswersPayload {
  answers: Answers;
  bankVersion?: string;  // 对应 TestBank.version，如 "v2-2026-07"
}

// ==================== 配对与类型匹配 ====================

/** 配对状态 */
export type PairStatus = 'pending' | 'completed' | 'expired';

/**
 * 解锁方式
 *
 * B-WC-1 修复：MVP 阶段深度内容免费开放，新增 'free'。
 * 'pay' / 'ad' 保留用于向后兼容前端旧版本，V2 接入虚拟支付后恢复。
 */
export type UnlockMethod = 'free' | 'pay' | 'ad';

/** 情侣类型（前端展示用） */
export interface CoupleTypeInfo {
  id: string;
  code: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  genderCombo: GenderCombo;
  estimatedRatio: number;
  oneLiner: string;
  description: string;
  hiddenRisks: string;
  growthAdvice: string;
  shareCopy: string;
  radarProfile: DimensionScores;
  attachmentCombo: string;
  conflictPattern: ConflictPattern;
  stage: RelationshipStage;
  marketingAngle?: string;
  isPublic: boolean;
}

/** 类型匹配结果 */
export interface TypeMatchResult {
  matched: CoupleTypeInfo;
  alternatives: CoupleTypeInfo[];
  compatibility: number;
  summary: string;
}

// ==================== API 响应 ====================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== 每日任务（Phase 4） ====================

/** 任务难度 */
export type TaskDifficulty = 'easy' | 'medium' | 'hard';

/** 任务状态（双方各自） */
export type TaskStatus = 'pending' | 'done' | 'skipped';

/** 任务来源分类（用于 fallback 预设库分类） */
export type TaskCategory =
  | 'self-awareness' // 自我觉察
  | 'relationship'   // 关系建设
  | 'communication'  // 沟通练习
  | 'emotion'        // 情绪处理
  | 'intimacy'       // 亲密提升
  | 'meaning';       // 共同意义

/** 任务生成引擎输入 */
export interface TaskGenerationInput {
  /** 情侣关系类型 code（用于风格化任务） */
  coupleTypeCode?: string;
  /** A 的 6 维度分数 */
  dimensionsA: DimensionScores;
  /** B 的 6 维度分数 */
  dimensionsB: DimensionScores;
  /** 关系阶段 */
  stage: RelationshipStage;
  /** 在一起的月数 */
  monthsTogether: number;
  /** 近 N 天 A 的情绪模式（负面/中性/正面，可空） */
  emotionTrendA?: EmotionTrend[];
  /** 近 N 天 B 的情绪模式 */
  emotionTrendB?: EmotionTrend[];
  /** A 昨日是否完成任务 */
  aCompletedYesterday: boolean;
  /** B 昨日是否完成任务 */
  bCompletedYesterday: boolean;
  /** 已连续生成天数（用于避免重复） */
  streakDays: number;
}

/** 情绪趋势单日记录 */
export interface EmotionTrend {
  date: string; // YYYY-MM-DD
  /** 情绪分（-2 极差 ~ +2 极好） */
  score: number;
}

/** 任务生成引擎输出（同时是 LLM 期望返回的 JSON 结构） */
export interface TaskGenerationOutput {
  title: string;
  description: string;
  difficulty: TaskDifficulty;
  /** 任务来源维度（D1-D6） */
  sourceDimension: Dimension;
  /** 任务目标改善维度（D1-D6，可空） */
  targetDimension?: Dimension;
  /** 预计完成分钟 */
  estimatedMin: number;
  /** 分类标签（fallback 库用） */
  category: TaskCategory;
}

/** 前端展示用的每日任务（GET /api/task/today / [taskId] 返回） */
export interface DailyTaskInfo {
  id: string;
  coupleId: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string;
  difficulty: TaskDifficulty;
  sourceDimension: Dimension;
  targetDimension?: Dimension;
  estimatedMin: number;
  /** 我的状态（pending/done/skipped） */
  myStatus: TaskStatus;
  /** 对方状态 */
  partnerStatus: TaskStatus;
  /** 双方都完成后生成的 AI 默契度总结 */
  aiSummary?: string;
  /** 我是否已提交回应（done 不等于已提交回应，skipped 也可能附带回应） */
  myResponded: boolean;
  /** 对方是否已提交回应 */
  partnerResponded: boolean;
  /** 我的回应（仅 GET /api/task/[taskId] 详情返回） */
  myResponse?: TaskResponseInfo;
  /** 对方回应 */
  partnerResponse?: TaskResponseInfo;
  createdAt: string;
}

/** 单方任务回应 */
export interface TaskResponseInfo {
  id: string;
  taskId: string;
  userId: string | null;
  content: string;
  /** AI 命名的情绪标签 */
  emotionTag?: string;
  /** AI 生成的视角解读 */
  perspective?: string;
  /** 图片 URL 数组（最多 3 张） */
  mediaUrls: string[];
  createdAt: string;
}

// ==================== V3 商业化:30 天挑战进度 ====================

/** 30 天挑战进度信息(断点续接) */
export interface ChallengeProgress {
  /** 已完成天数(双方都 done,累计值,断点后不重置) */
  completedDates: number;
  /** 总天数 */
  totalDays: number;
  /** 当前连续是否活着 */
  streakAlive: boolean;
  /** 上次中断日期(ISO 字符串),未中断过则为 null */
  lastBreakDate: string | null;
  /** 今天双方是否都 done */
  todayCompleted: boolean;
}

/** 历史某天的完成情况(用于进度查询 history) */
export interface ChallengeHistoryItem {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** A 是否完成 */
  aDone: boolean;
  /** B 是否完成 */
  bDone: boolean;
  /** 双方是否都完成 */
  bothDone: boolean;
}

/** LLM 情绪命名返回结构 */
export interface EmotionNamingResult {
  emotionTag: string;
  perspective: string;
}

/** LLM 任务总结返回结构（双方完成后生成默契度） */
export interface TaskSummaryResult {
  /** 默契度 0-100 */
  compatibility: number;
  /** AI 总结文本 */
  summary: string;
  /** 共鸣点（双方相似的视角） */
  resonancePoints?: string[];
  /** 互补点（双方不同的视角） */
  complementaryPoints?: string[];
}

/** 7 维权重框架的权重配置（用于任务生成引擎） */
export interface TaskWeightConfig {
  /** 短板维度权重（D1-D6 最低分维度） */
  weakness: number;
  /** 近期情绪模式权重 */
  emotionTrend: number;
  /** 不对称检测权重（一方未完成） */
  asymmetry: number;
  /** 关系阶段权重 */
  stage: number;
  /** 连续天数权重（避免重复） */
  streak: number;
  /** 类型风格权重 */
  coupleType: number;
  /** 随机性权重（保证多样性） */
  randomness: number;
}

// =====================================================================
// Phase 5 · 成长报告与付费
// =====================================================================

/** 报告区间 */
export type ReportRange = '7d' | '30d';

/** 订阅套餐 */
export type SubscriptionPlan = 'monthly' | 'yearly';

/** 订阅状态 */
export type SubscriptionStatus = 'active' | 'expired' | 'canceled' | 'none';

/** 单日任务统计 */
export interface DailyTaskStat {
  /** YYYY-MM-DD */
  date: string;
  /** A 是否完成（done/skipped 视为完成） */
  aDone: boolean;
  /** B 是否完成 */
  bDone: boolean;
  /** 双方默契度（来自 aiSummary，无则 null） */
  compatibility: number | null;
  /** 任务标题 */
  taskTitle: string;
  /** 来源维度 */
  sourceDimension: Dimension;
}

/** 维度变化（前 30d vs 近 7d 或近 7d vs 当前） */
export interface DimensionChange {
  dimension: Dimension;
  /** 起始分（0-100） */
  fromScore: number;
  /** 终止分（0-100） */
  toScore: number;
  /** 变化绝对值（toScore - fromScore） */
  delta: number;
  /** 变化百分比（保留 0 位小数，如 15 表示 +15%） */
  deltaPercent: number;
}

/** 报告聚合数据（lib/report.ts 聚合后产出，供 LLM Prompt 和 API 共用） */
export interface ReportAggregation {
  /** 区间 */
  range: ReportRange;
  /** 起始日期 YYYY-MM-DD */
  startDate: string;
  /** 结束日期 YYYY-MM-DD */
  endDate: string;
  /** 区间内应完成任务数（按天计） */
  totalDays: number;
  /** A 完成天数 */
  aCompletedDays: number;
  /** B 完成天数 */
  bCompletedDays: number;
  /** 双方都完成的天数 */
  bothCompletedDays: number;
  /** A 完成率（0-1） */
  aCompletionRate: number;
  /** B 完成率（0-1） */
  bCompletionRate: number;
  /** 双方完成率 */
  bothCompletionRate: number;
  /** 平均默契度（区间内有 aiSummary 的任务平均） */
  avgCompatibility: number | null;
  /** 默契度趋势（按时间排序，用于情绪曲线） */
  compatibilityTrend: Array<{ date: string; compatibility: number }>;
  /** 6 维度变化 */
  dimensionChanges: DimensionChange[];
  /** 区间内每日任务统计 */
  dailyStats: DailyTaskStat[];
  /** 连续打卡天数（截至 endDate） */
  streakDays: number;
}

/** LLM 报告生成返回结构 */
export interface ReportLLMResult {
  /** 报告标题（10-20 字） */
  title: string;
  /** 叙事摘要（200-400 字，含「你们这周的变化」叙事） */
  narrative: string;
  /** 亮点（1-3 条） */
  highlights: string[];
  /** 成长建议（1-3 条，具体可执行） */
  suggestions: string[];
  /** 一句话寄语（30 字内） */
  blessing: string;
}

/** 报告最终返回结构（API 返回 + 分享用） */
export interface CoupleReport {
  /** 报告 ID（coupleId + range + endDate 组合的 hash） */
  id: string;
  coupleId: string;
  range: ReportRange;
  startDate: string;
  endDate: string;
  /** 聚合数据 */
  aggregation: ReportAggregation;
  /** LLM 生成内容（付费后才有；免费版仅 title + blessing） */
  narrative?: ReportLLMResult;
  /** 是否已解锁完整报告 */
  unlocked: boolean;
  /** 生成时间 */
  generatedAt: string;
}

/** 订阅信息（User.subscription 字段结构） */
export interface SubscriptionInfo {
  /** 套餐 */
  plan: SubscriptionPlan | null;
  /** 状态 */
  status: SubscriptionStatus;
  /** 当前周期开始时间 ISO */
  currentPeriodStart: string | null;
  /** 当前周期结束时间 ISO（过期时间） */
  currentPeriodEnd: string | null;
  /** 是否自动续费（小程序订阅暂不支持取消，固定 true） */
  autoRenew: boolean;
  /** 上次支付商户订单号 */
  lastOutTradeNo: string | null;
}

/** 危机关键词检测结果 */
export interface CrisisDetectionResult {
  /** 是否触发危机流程 */
  triggered: boolean;
  /** 命中的关键词列表 */
  matchedKeywords: string[];
  /** 风险等级（low/middle/high） */
  level: 'low' | 'middle' | 'high';
}

// =====================================================================
// V3 · 多维度分析（深度解锁后 LLM 生成）
// =====================================================================

/** V3 多维度分析结果(LLM 生成) */
export interface MultiDimAnalysis {
  overview: string;
  dimensions: {
    code: string;
    name: string;
    analysis: string;
  }[];
  suggestions: string[];
}
