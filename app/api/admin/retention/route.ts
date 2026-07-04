/**
 * 留存曲线看板 API（Phase 6.8）
 * GET /api/admin/retention?cohortDays=30&retentionDays=30
 *
 * 返回某日注册 cohort 在后续 N 天的留存率：
 * - Day 0：注册当天（100%）
 * - Day 1：注册次日还活跃的用户比例
 * - Day 7：注册 7 日后还活跃的用户比例
 * - Day 30：注册 30 日后还活跃的用户比例
 *
 * 留存定义：用户当天有任意 TrackEvent 或 TaskResponse（视为活跃）
 *
 * 鉴权：Authorization: Bearer ${ADMIN_TOKEN}
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import type { ApiResponse } from '@/shared/types';
// V2 优化（S-1）：原 retention 接口类型在 API 路由和 dashboard 客户端重复定义，
// 改为统一引用 shared/admin-types.ts，避免字段不一致
import type { RetentionPoint, RetentionData } from '@/shared/admin-types';

/** V2 优化（W-7）：cohort userIds 数组上限，避免大数据量内存溢出 */
const MAX_COHORT_USERS = 10000;

/** V2 优化（S-2）：分批查询每批 userId 数量，避免单次 SQL 超连接/查询超时 */
const QUERY_BATCH_SIZE = 1000;

/**
 * 计算某日 cohort 的留存曲线
 *
 * 思路：
 * 1. 找出 cohort 期间首次出现的用户（trackEvents 表中第一次出现）
 * 2. 对每个用户，检查后续第 N 天是否还有活跃事件
 * 3. 聚合：retentionRate = 活跃用户数 / cohort 总人数
 */
export async function GET(request: NextRequest) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未授权' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = request.nextUrl;
    const cohortDaysParam = searchParams.get('cohortDays');
    const retentionDaysParam = searchParams.get('retentionDays');

    const cohortDays = Math.min(90, Math.max(1, parseInt(cohortDaysParam || '7', 10)));
    const retentionDays = Math.min(60, Math.max(1, parseInt(retentionDaysParam || '30', 10)));

    // cohort 窗口：最近 cohortDays 天内首次活跃的用户
    const now = new Date();
    const cohortEnd = new Date(now);
    const cohortStart = new Date(now);
    cohortStart.setDate(cohortStart.getDate() - cohortDays);

    // 找 cohort 用户：在 cohort 窗口内首次出现 userId 的记录
    // Prisma 不直接支持「first appearance」查询，用 raw SQL 高效实现
    const cohortUsers = await prisma.$queryRaw<Array<{ userId: string; firstDay: Date }>>`
      SELECT
        "userId" AS "userId",
        DATE_TRUNC('day', MIN("createdAt")) AS "firstDay"
      FROM track_events
      WHERE
        "userId" IS NOT NULL
        AND "createdAt" >= ${cohortStart}
        AND "createdAt" <= ${cohortEnd}
      GROUP BY "userId"
      HAVING DATE_TRUNC('day', MIN("createdAt")) >= ${cohortStart}
         AND DATE_TRUNC('day', MIN("createdAt")) <= ${cohortEnd}
    `;

    // V2 优化（W-7）：原 userIds 数组无上限，大数据量时内存溢出；
    // 改为 slice(0, MAX_COHORT_USERS) 限制 + console.warn 日志告警
    const cohortSizeRaw = cohortUsers.length;
    let cohortUsersLimited = cohortUsers;
    if (cohortSizeRaw > MAX_COHORT_USERS) {
      console.warn(
        `[retention] W-7 告警：cohort 用户数 ${cohortSizeRaw} 超过上限 ${MAX_COHORT_USERS}，已截断。建议缩小 cohortDays 或加分页。`,
      );
      cohortUsersLimited = cohortUsers.slice(0, MAX_COHORT_USERS);
    }
    const cohortSize = cohortUsersLimited.length;

    if (cohortSize === 0) {
      const data: RetentionData = {
        cohortSize: 0,
        cohortStart: cohortStart.toISOString().slice(0, 10),
        cohortEnd: cohortEnd.toISOString().slice(0, 10),
        curve: Array.from({ length: retentionDays + 1 }, (_, i) => ({
          day: i,
          activeUsers: 0,
          retentionRate: 0,
        })),
      };
      return NextResponse.json<ApiResponse<RetentionData>>({
        success: true,
        data,
      });
    }

    // 对每个留存日（0 到 retentionDays），统计 cohort 中当天活跃的用户数
    // 优化：用一条 raw SQL 一次查出所有留存日的活跃数
    // SELECT d AS day, COUNT(DISTINCT "userId") FROM generate_series(0, retentionDays) AS d
    //   JOIN track_events ON DATE_TRUNC('day', "createdAt") = firstDay + d
    //   AND "userId" IN (cohort user ids)
    //   GROUP BY d

    const userIds = cohortUsersLimited.map((u) => u.userId);
    const userFirstDayMap = new Map<string, string>();
    for (const u of cohortUsersLimited) {
      userFirstDayMap.set(u.userId, new Date(u.firstDay).toISOString().slice(0, 10));
    }

    // 一次性查询 cohort 用户在 cohort 起到 cohortEnd + retentionDays 内的所有活跃日期
    const observationEnd = new Date(cohortEnd);
    observationEnd.setDate(observationEnd.getDate() + retentionDays);

    // V2 优化（S-2）：原单次 "userId" = ANY(${userIds}::text[]) 在 userIds 较大时
    // 可能触发 DB 连接/查询超时；改为按 QUERY_BATCH_SIZE 分批查询再合并结果
    const activeRecords: Array<{ userId: string; activeDay: Date }> = [];
    for (let i = 0; i < userIds.length; i += QUERY_BATCH_SIZE) {
      const batch = userIds.slice(i, i + QUERY_BATCH_SIZE);
      const batchRecords = await prisma.$queryRaw<Array<{ userId: string; activeDay: Date }>>`
        SELECT
          "userId" AS "userId",
          DATE_TRUNC('day', "createdAt") AS "activeDay"
        FROM track_events
        WHERE
          "userId" = ANY(${batch}::text[])
          AND "createdAt" <= ${observationEnd}
        GROUP BY "userId", DATE_TRUNC('day', "createdAt")
      `;
      activeRecords.push(...batchRecords);
    }

    // 构建每个用户的活跃日集合
    const userActiveDaysMap = new Map<string, Set<string>>();
    for (const rec of activeRecords) {
      const dayStr = new Date(rec.activeDay).toISOString().slice(0, 10);
      const userId = rec.userId;
      if (!userActiveDaysMap.has(userId)) {
        userActiveDaysMap.set(userId, new Set());
      }
      userActiveDaysMap.get(userId)!.add(dayStr);
    }

    // 计算留存曲线
    // V2 优化（W-3）：原为双重循环「for d in 0..retentionDays × for user in cohortUsers」
    // 时间复杂度 O(retentionDays × cohortSize)，大数据量性能差；
    // 改为遍历每个用户的实际活跃日集合（Set），用日期差直接定位 d 索引并计数，
    // 时间复杂度 O(Σ 每用户活跃天数)，通常远小于 O(d × n)，
    // 同时 Set.has 仍是 O(1)，整体接近线性。
    const dailyActiveCount = new Array<number>(retentionDays + 1).fill(0);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    for (const user of cohortUsersLimited) {
      const firstDayStr = userFirstDayMap.get(user.userId)!;
      const firstDayDate = new Date(firstDayStr + 'T00:00:00Z');
      const activeDays = userActiveDaysMap.get(user.userId);
      if (!activeDays || activeDays.size === 0) continue;

      // 只遍历该用户实际活跃的日期，而非所有 retentionDays
      for (const activeDayStr of activeDays) {
        const activeDate = new Date(activeDayStr + 'T00:00:00Z');
        const diffMs = activeDate.getTime() - firstDayDate.getTime();
        // 用 round 避免夏令时等导致的天数漂移
        const d = Math.round(diffMs / MS_PER_DAY);
        if (d >= 0 && d <= retentionDays) {
          dailyActiveCount[d] += 1;
        }
      }
    }

    const curve: RetentionPoint[] = dailyActiveCount.map((activeUsers, d) => ({
      day: d,
      activeUsers,
      retentionRate: cohortSize > 0
        ? Math.round((activeUsers / cohortSize) * 1000) / 10
        : 0,
    }));

    const data: RetentionData = {
      cohortSize,
      cohortStart: cohortStart.toISOString().slice(0, 10),
      cohortEnd: cohortEnd.toISOString().slice(0, 10),
      curve,
    };

    return NextResponse.json<ApiResponse<RetentionData>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询留存失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
