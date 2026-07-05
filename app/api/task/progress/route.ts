/**
 * 查询 30 天挑战进度
 * GET /api/task/progress?coupleId=...
 *
 * 返回:
 * - completedDates:已完成天数(双方都 done)
 * - totalDays:30
 * - streakAlive:当前连续是否活着
 * - lastBreakDate:上次中断日期
 * - todayCompleted:今天双方是否都 done
 * - history:最近 7 天完成情况
 *
 * 逻辑:
 * 1. 查 Couple 验证权限
 * 2. 查最近 30 个 DailyTask,统计双方都 done 的天数
 * 3. 计算连续中断点
 * 4. 返回进度对象
 *
 * 注:本路由从 DailyTask 历史重新计算进度(源真),
 * 与 /api/task/today 的缓存字段(completedDates/streakAlive)相互独立,
 * 可用于校正缓存或展示详细历史。
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import {
  getCoupleForUser,
  getDefaultTimezone,
  getTodayDateInTimezone,
} from '@/lib/task-service';
import type {
  ApiResponse,
  ChallengeProgress,
  ChallengeHistoryItem,
} from '@/shared/types';

/** 30 天挑战总天数 */
const CHALLENGE_TOTAL_DAYS = 30;

/** 历史返回天数 */
const HISTORY_DAYS = 7;

/** Date → 'YYYY-MM-DD'(UTC 午夜) */
function formatDateToStr(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface ProgressData extends ChallengeProgress {
  /** 最近 7 天完成情况(按日期升序) */
  history: ChallengeHistoryItem[];
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthHeader(
      request.headers.get('Authorization'),
    );
    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未登录' },
        { status: 401 },
      );
    }

    const coupleId = request.nextUrl.searchParams.get('coupleId');
    if (!coupleId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 coupleId 参数' },
        { status: 400 },
      );
    }

    // 1. 查 Couple 验证权限
    const couple = await getCoupleForUser(userId);
    if (!couple || couple.id !== coupleId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 2. 时区 + 今日日期
    const timezone = getDefaultTimezone();
    const { dateObj: todayDateObj } = getTodayDateInTimezone(timezone);

    // 3. 查最近 30 个 DailyTask(按日期降序)
    const tasks = await prisma.dailyTask.findMany({
      where: { coupleId },
      orderBy: { date: 'desc' },
      take: CHALLENGE_TOTAL_DAYS,
      select: {
        date: true,
        statusA: true,
        statusB: true,
      },
    });

    // 4. 统计双方都 done 的天数
    let completedDates = 0;
    let todayCompleted = false;
    let mostRecentBreakDate: Date | null = null;
    let yesterdayBothDone = false;

    // todayStr / yesterdayStr 用于比对
    const todayStr = formatDateToStr(todayDateObj);
    const yesterdayObj = new Date(todayDateObj);
    yesterdayObj.setUTCDate(yesterdayObj.getUTCDate() - 1);
    const yesterdayStr = formatDateToStr(yesterdayObj);

    for (const t of tasks) {
      const aDone = t.statusA === 'done';
      const bDone = t.statusB === 'done';
      const bothDone = aDone && bDone;
      const dateStr = formatDateToStr(t.date);

      if (bothDone) {
        completedDates += 1;
      }

      // 今天是否双方都 done
      if (dateStr === todayStr) {
        todayCompleted = bothDone;
      }

      // 昨天是否双方都 done(用于 streakAlive 判断)
      if (dateStr === yesterdayStr) {
        yesterdayBothDone = bothDone;
      }

      // 找最近的"中断日"(排除今天,今天 pending 不算中断)
      // 中断 = 任一方未 done(包括 skipped)
      if (!bothDone && dateStr !== todayStr && !mostRecentBreakDate) {
        // tasks 已按 date desc 排序,第一个非 both-done(且非今天)即为最近中断日
        mostRecentBreakDate = t.date;
      }
    }

    // 5. 计算 streakAlive
    // 语义与 /api/task/today 一致:昨天双方都 done → streakAlive=true
    const streakAlive = yesterdayBothDone;

    // 6. 构建 history(最近 7 天,按日期升序)
    const history: ChallengeHistoryItem[] = tasks
      .filter((t) => {
        const dateStr = formatDateToStr(t.date);
        return dateStr <= todayStr;
      })
      .slice(0, HISTORY_DAYS)
      .map((t) => {
        const aDone = t.statusA === 'done';
        const bDone = t.statusB === 'done';
        return {
          date: formatDateToStr(t.date),
          aDone,
          bDone,
          bothDone: aDone && bDone,
        };
      })
      .reverse(); // 升序(旧 → 新)

    const data: ProgressData = {
      completedDates,
      totalDays: CHALLENGE_TOTAL_DAYS,
      streakAlive,
      lastBreakDate: mostRecentBreakDate
        ? mostRecentBreakDate.toISOString()
        : null,
      todayCompleted,
      history,
    };

    return NextResponse.json<ApiResponse<ProgressData>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询进度失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
