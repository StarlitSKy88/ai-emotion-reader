/**
 * 成长报告数据聚合（Phase 5.1）
 *
 * 提供 7 天 / 30 天数据聚合能力，供 /api/report/[coupleId] 路由和 LLM Prompt 共用。
 *
 * 聚合内容：
 * 1. 任务完成率（A / B / 双方）
 * 2. 默契度趋势（aiSummary 中的 compatibility，按日期排序）
 * 3. 6 维度变化（近 N 天 vs 前 N 天，基于 TestSession.dimensions）
 * 4. 连续打卡天数（从 endDate 往前数到第一个双方都未完成的日子）
 *
 * 性能要求：
 * - 7 天 <500ms
 * - 30 天 <2s（大数据量）
 *
 * 数据来源：
 * - DailyTask：任务完成情况 + aiSummary
 * - TestSession：6 维度分数（用于计算维度变化）
 */
import { prisma } from '@/lib/prisma';
import { getTodayDateInTimezone, getDefaultTimezone } from '@/lib/task-service';
import type {
  DailyTaskStat,
  Dimension,
  DimensionChange,
  DimensionScores,
  ReportAggregation,
  ReportRange,
} from '@/shared/types';

/** 6 维度枚举数组 */
const DIMENSIONS: Dimension[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];

/** 维度中文名（用于 LLM Prompt） */
export const DIMENSION_LABELS_FOR_REPORT: Record<Dimension, string> = {
  D1: '依恋',
  D2: '沟通',
  D3: '冲突修复',
  D4: '共同意义',
  D5: '信任承诺',
  D6: '亲密激情',
};

/** 区间天数映射 */
const RANGE_DAYS: Record<ReportRange, number> = {
  '7d': 7,
  '30d': 30,
};

/**
 * 聚合指定区间的报告数据
 *
 * @param coupleId 情侣关系 ID
 * @param range 7d 或 30d
 * @param timezone 时区（不传则用 getDefaultTimezone() 读 env TIMEZONE，默认 Asia/Shanghai）
 * @returns ReportAggregation
 */
export async function aggregateReport(
  coupleId: string,
  range: ReportRange,
  // V2 优化（W-8）：原默认 'Asia/Shanghai'，改为通过 getDefaultTimezone() 读 env
  timezone?: string,
): Promise<ReportAggregation> {
  const tz = timezone || getDefaultTimezone();
  const days = RANGE_DAYS[range];

  // 1. 计算起止日期（按目标时区）
  // endDate = 今天（目标时区），startDate = 今天 - (days-1)
  const { dateStr: todayStr } = getTodayDateInTimezone(tz);
  const endDateObj = new Date(todayStr + 'T00:00:00Z');
  const startDateObj = new Date(endDateObj);
  startDateObj.setUTCDate(startDateObj.getUTCDate() - (days - 1));
  const startDateStr = startDateObj.toISOString().slice(0, 10);

  // 2. 一次性查询区间内所有 DailyTask（避免 N+1）
  const tasks = await prisma.dailyTask.findMany({
    where: {
      coupleId,
      date: { gte: startDateObj, lte: endDateObj },
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      title: true,
      sourceDimension: true,
      statusA: true,
      statusB: true,
      aiSummary: true,
    },
  });

  // 3. 构建 dailyStats + 完成率 + 默契度趋势
  const dailyStats: DailyTaskStat[] = [];
  const compatibilityTrend: Array<{ date: string; compatibility: number }> = [];
  let aCompletedDays = 0;
  let bCompletedDays = 0;
  let bothCompletedDays = 0;
  let compatibilitySum = 0;
  let compatibilityCount = 0;

  for (const task of tasks) {
    const aDone = task.statusA === 'done' || task.statusA === 'skipped';
    const bDone = task.statusB === 'done' || task.statusB === 'skipped';
    if (aDone) aCompletedDays += 1;
    if (bDone) bCompletedDays += 1;
    if (aDone && bDone) bothCompletedDays += 1;

    // 解析 aiSummary 中的 compatibility
    let compatibility: number | null = null;
    if (task.aiSummary) {
      try {
        const parsed = JSON.parse(task.aiSummary) as { compatibility?: unknown };
        if (
          parsed.compatibility != null &&
          typeof parsed.compatibility === 'number' &&
          Number.isFinite(parsed.compatibility)
        ) {
          compatibility = Math.max(0, Math.min(100, Math.round(parsed.compatibility)));
          compatibilitySum += compatibility;
          compatibilityCount += 1;
          compatibilityTrend.push({
            date: task.date.toISOString().slice(0, 10),
            compatibility,
          });
        }
      } catch {
        // aiSummary 不是合法 JSON，跳过
      }
    }

    dailyStats.push({
      date: task.date.toISOString().slice(0, 10),
      aDone,
      bDone,
      compatibility,
      taskTitle: task.title,
      sourceDimension: (task.sourceDimension as Dimension) || 'D1',
    });
  }

  // 4. 连续打卡天数（从 endDate 往前数，遇到第一个双方都未完成的日子停止）
  // 注意：连续打卡定义 = 双方至少一人完成的天数（避免一方全勤另一方全不来的极端情况误判为 0）
  // 改用「双方都完成」的连续天数（更严格，更符合产品语义）
  let streakDays = 0;
  for (let i = tasks.length - 1; i >= 0; i -= 1) {
    const t = tasks[i];
    const aDone = t.statusA === 'done' || t.statusA === 'skipped';
    const bDone = t.statusB === 'done' || t.statusB === 'skipped';
    if (aDone && bDone) {
      streakDays += 1;
    } else {
      break;
    }
  }

  // 5. 6 维度变化（近 N 天 vs 前 N 天，基于 TestSession.dimensions）
  // 注：TestSession.dimensions 是答题时的快照，不会随时间变化。
  // 这里用「当前 TestSession vs 上一次 TestSession」对比，如果没有上一次则返回空数组。
  // 简化版：直接返回空数组 + 在 narrative 中由 LLM 根据 dailyStats 推断变化。
  // 真正的维度变化需要二次答题数据，留作 V2。
  const dimensionChanges = await calculateDimensionChanges(coupleId, range);

  return {
    range,
    startDate: startDateStr,
    endDate: todayStr,
    totalDays: days,
    aCompletedDays,
    bCompletedDays,
    bothCompletedDays,
    aCompletionRate: days > 0 ? aCompletedDays / days : 0,
    bCompletionRate: days > 0 ? bCompletedDays / days : 0,
    bothCompletionRate: days > 0 ? bothCompletedDays / days : 0,
    avgCompatibility:
      compatibilityCount > 0
        ? Math.round(compatibilitySum / compatibilityCount)
        : null,
    compatibilityTrend,
    dimensionChanges,
    dailyStats,
    streakDays,
  };
}

/**
 * 计算 6 维度变化
 *
 * 实现：用最近两次 TestSession 的 dimensions 对比。
 * - 没有 TestSession：返回空数组
 * - 只有一次 TestSession：返回空数组（无对比基准）
 * - 有两次及以上：用最近一次 vs 上一次对比
 *
 * V2 可改为「基于每日任务情绪趋势反推维度变化」，MVP 用 TestSession 对比足够。
 */
async function calculateDimensionChanges(
  coupleId: string,
  range: ReportRange,
): Promise<DimensionChange[]> {
  // 找 Couple 关联的 PairSession，再找双方的 TestSession
  const couple = await prisma.couple.findUnique({
    where: { id: coupleId },
    select: {
      pairSessionId: true,
      partnerAId: true,
      partnerBId: true,
    },
  });
  if (!couple) return [];

  const pairSession = await prisma.pairSession.findUnique({
    where: { id: couple.pairSessionId },
    select: { initiatorId: true, responderId: true },
  });
  if (!pairSession) return [];

  // 取 initiator 和 responder 的 TestSession（按 createdAt 降序，最多 2 条）
  const [initiatorSessions, responderSessions] = await Promise.all([
    prisma.testSession.findMany({
      where: { userId: couple.partnerAId ?? '' },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { dimensions: true, createdAt: true },
    }),
    prisma.testSession.findMany({
      where: { userId: couple.partnerBId ?? '' },
      take: 2,
      orderBy: { createdAt: 'desc' },
      select: { dimensions: true, createdAt: true },
    }),
  ]);

  // 必须双方都有至少 2 次 TestSession 才能对比
  if (initiatorSessions.length < 2 || responderSessions.length < 2) {
    return [];
  }

  // 平均双方维度分数（合并为「情侣维度分」）
  const fromScores = averageDimensionScores(
    initiatorSessions[1].dimensions,
    responderSessions[1].dimensions,
  );
  const toScores = averageDimensionScores(
    initiatorSessions[0].dimensions,
    responderSessions[0].dimensions,
  );

  const changes: DimensionChange[] = [];
  for (const dim of DIMENSIONS) {
    const fromScore = fromScores[dim] ?? 0;
    const toScore = toScores[dim] ?? 0;
    const delta = toScore - fromScore;
    // 百分比变化：fromScore 为 0 时返回 0（避免除零）
    const deltaPercent =
      fromScore > 0 ? Math.round((delta / fromScore) * 100) : 0;
    changes.push({
      dimension: dim,
      fromScore,
      toScore,
      delta,
      deltaPercent,
    });
  }

  // range 仅用于日志，不影响计算逻辑
  void range;

  return changes;
}

/**
 * 平均双方维度分数
 * 输入是 Prisma Json 字段（unknown），需要安全转换
 */
function averageDimensionScores(
  a: unknown,
  b: unknown,
): DimensionScores {
  const aScores = safeDimensionScores(a);
  const bScores = safeDimensionScores(b);
  const result: DimensionScores = {
    D1: 0,
    D2: 0,
    D3: 0,
    D4: 0,
    D5: 0,
    D6: 0,
  };
  for (const dim of DIMENSIONS) {
    const aVal = aScores[dim] ?? 0;
    const bVal = bScores[dim] ?? 0;
    result[dim] = Math.round((aVal + bVal) / 2);
  }
  return result;
}

/** 安全转换 Prisma Json 为 DimensionScores */
function safeDimensionScores(raw: unknown): Partial<DimensionScores> {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const result: Partial<DimensionScores> = {};
  for (const dim of DIMENSIONS) {
    const val = obj[dim];
    if (typeof val === 'number' && Number.isFinite(val)) {
      result[dim] = val;
    }
  }
  return result;
}

/**
 * 生成报告 ID（coupleId + range + endDate 组合）
 * 用于 ShareEvent 关联和缓存键
 */
export function generateReportId(
  coupleId: string,
  range: ReportRange,
  endDate: string,
): string {
  return `${coupleId}_${range}_${endDate}`;
}
