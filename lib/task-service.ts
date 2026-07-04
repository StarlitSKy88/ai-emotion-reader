/**
 * 问心 AI · 每日任务服务层（Phase 4.3 辅助）
 *
 * 封装 task API 路由共用的逻辑：
 * - getCoupleForUser：从 userId 找到 active Couple
 * - getTodayDateInTimezone：按时区获取今日日期（YYYY-MM-DD + Date 对象）
 * - buildDailyTaskInfo：把 Prisma DailyTask 转为前端 DailyTaskInfo
 * - parseJsonFromLlm：从 LLM 输出提取 JSON（与 open-question-analyzer 一致）
 */
import { prisma } from './prisma';
import type {
  DailyTaskInfo,
  Dimension,
  TaskDifficulty,
  TaskStatus,
} from '@/shared/types';

/** Couple 含 partnerA/B 用户信息的类型 */
export type CoupleWithUsers = {
  id: string;
  pairSessionId: string;
  partnerAId: string | null;
  partnerBId: string | null;
  stage: string;
  profile: unknown;
  createdAt: Date;
  pairSession: {
    id: string;
    dimensionsA: unknown;
    dimensionsB: unknown;
    genderCombo: string;
    matchedTypeId: string | null;
  } | null;
};

/**
 * 从 userId 找到 active Couple
 * 用户可能是 partnerA 或 partnerB
 *
 * @returns Couple 含 pairSession 关联，或 null（未配对）
 */
export async function getCoupleForUser(
  userId: string,
): Promise<CoupleWithUsers | null> {
  const couple = await prisma.couple.findFirst({
    where: {
      OR: [{ partnerAId: userId }, { partnerBId: userId }],
      status: 'active',
    },
    include: {
      pairSession: {
        select: {
          id: true,
          dimensionsA: true,
          dimensionsB: true,
          genderCombo: true,
          matchedTypeId: true,
        },
      },
    },
  });
  return couple;
}

/**
 * 判断用户在 couple 中是 A 还是 B
 * @returns 'A' / 'B' / null（用户不属于该 couple）
 */
export function getUserRoleInCouple(
  couple: CoupleWithUsers,
  userId: string,
): 'A' | 'B' | null {
  if (couple.partnerAId === userId) return 'A';
  if (couple.partnerBId === userId) return 'B';
  return null;
}

/**
 * 获取对方 userId
 */
export function getPartnerUserId(
  couple: CoupleWithUsers,
  userId: string,
): string | null {
  if (couple.partnerAId === userId) return couple.partnerBId;
  if (couple.partnerBId === userId) return couple.partnerAId;
  return null;
}

/**
 * 获取默认时区
 * V2 优化（W-8）：原硬编码 'Asia/Shanghai'，改为从环境变量 TIMEZONE 读取（默认 'Asia/Shanghai'）
 * @returns IANA 时区字符串
 */
export function getDefaultTimezone(): string {
  return process.env.TIMEZONE || 'Asia/Shanghai';
}

/**
 * 按时区获取今日日期
 * @param timezone IANA 时区，如 'Asia/Shanghai'（不传则用 getDefaultTimezone()）
 * @returns { dateStr: 'YYYY-MM-DD', dateObj: Date（@db.Date 用） }
 */
export function getTodayDateInTimezone(timezone?: string): {
  dateStr: string;
  dateObj: Date;
} {
  // V2 优化（W-8）：timezone 改为可选，未传时用 getDefaultTimezone() 读 env
  const tz = timezone || getDefaultTimezone();
  // 用 Intl.DateTimeFormat 获取指定时区的日期
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(now); // en-CA 格式就是 YYYY-MM-DD

  // @db.Date 只需要日期部分，用 UTC 午夜构造避免时区偏移
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));

  return { dateStr, dateObj };
}

/** DailyTask 含 responses 的 Prisma 类型 */
export type DailyTaskWithResponses = {
  id: string;
  coupleId: string;
  date: Date;
  timezone: string;
  title: string;
  description: string;
  difficulty: string;
  sourceDimension: string;
  targetDimension: string | null;
  estimatedMin: number;
  statusA: string;
  statusB: string;
  aiSummary: string | null;
  createdAt: Date;
  responses: Array<{
    id: string;
    taskId: string;
    userId: string | null;
    content: string;
    emotionTag: string | null;
    perspective: string | null;
    mediaUrls: unknown;
    createdAt: Date;
  }>;
};

/**
 * 把 Prisma DailyTask 转为前端 DailyTaskInfo
 *
 * @param task Prisma DailyTask（含 responses）
 * @param userId 当前用户 ID
 * @param couple Couple（用于判断 A/B 角色）
 * @param includeResponses 是否包含双方回应详情（GET /api/task/[taskId] 时 true）
 */
export function buildDailyTaskInfo(
  task: DailyTaskWithResponses,
  userId: string,
  couple: CoupleWithUsers,
  includeResponses: boolean,
): DailyTaskInfo {
  const role = getUserRoleInCouple(couple, userId);
  const myStatus = (role === 'A' ? task.statusA : task.statusB) as TaskStatus;
  const partnerStatus = (role === 'A' ? task.statusB : task.statusA) as TaskStatus;

  // 找到双方各自的回应
  const myResponse = task.responses.find((r) => r.userId === userId);
  const partnerUserId = getPartnerUserId(couple, userId);
  const partnerResponse = partnerUserId
    ? task.responses.find((r) => r.userId === partnerUserId)
    : undefined;

  const base: DailyTaskInfo = {
    id: task.id,
    coupleId: task.coupleId,
    date: formatDateToStr(task.date),
    title: task.title,
    description: task.description,
    difficulty: task.difficulty as TaskDifficulty,
    sourceDimension: task.sourceDimension as Dimension,
    targetDimension: (task.targetDimension as Dimension) || undefined,
    estimatedMin: task.estimatedMin,
    myStatus,
    partnerStatus,
    aiSummary: task.aiSummary || undefined,
    myResponded: !!myResponse,
    partnerResponded: !!partnerResponse,
    createdAt: task.createdAt.toISOString(),
  };

  if (includeResponses) {
    base.myResponse = myResponse
      ? toTaskResponseInfo(myResponse)
      : undefined;
    base.partnerResponse = partnerResponse
      ? toTaskResponseInfo(partnerResponse)
      : undefined;
  }

  return base;
}

/** 把 Prisma TaskResponse 转为 TaskResponseInfo */
function toTaskResponseInfo(r: DailyTaskWithResponses['responses'][number]): {
  id: string;
  taskId: string;
  userId: string | null;
  content: string;
  emotionTag?: string;
  perspective?: string;
  mediaUrls: string[];
  createdAt: string;
} {
  const mediaUrls = Array.isArray(r.mediaUrls) ? (r.mediaUrls as string[]) : [];
  return {
    id: r.id,
    taskId: r.taskId,
    userId: r.userId,
    content: r.content,
    emotionTag: r.emotionTag || undefined,
    perspective: r.perspective || undefined,
    mediaUrls,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Date → 'YYYY-MM-DD' */
function formatDateToStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 从 LLM 输出中提取 JSON
 * 兼容模型可能附带 markdown 代码块或多余文本
 */
export function parseJsonFromLlm<T>(raw: string): T | null {
  try {
    // 先尝试直接 parse
    return JSON.parse(raw) as T;
  } catch {
    // 失败则提取第一个 {...} 块
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

/**
 * 校验维度分数对象完整性（D1-D6 全部为数字）
 * 与 submit 路由的 isValidDimensions 一致，避免重复定义
 */
export function isValidDimensions(
  dims: unknown,
): dims is Record<Dimension, number> {
  if (!dims || typeof dims !== 'object') return false;
  const d = dims as Record<string, unknown>;
  return (['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const).every(
    (key) => typeof d[key] === 'number' && !Number.isNaN(d[key]),
  );
}
