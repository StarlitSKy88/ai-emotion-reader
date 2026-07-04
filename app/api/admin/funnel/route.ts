/**
 * 转化漏斗看板 API（Phase 6.7）
 * GET /api/admin/funnel?days=30
 *
 * 返回最近 N 天的转化漏斗数据：
 * 1. landing_visit：落地页访问（page_view: pages/index/index）
 * 2. test_start：开始测试
 * 3. test_complete：完成测试
 * 4. pair_join：加入配对（成功匹配关系）
 * 5. task_complete：完成任务（首日任务完成）
 * 6. subscribe_success：订阅成功
 *
 * 每步显示：count + 转化率（相对上一步）+ 整体转化率（相对第 1 步）
 *
 * 鉴权：Authorization: Bearer ${ADMIN_TOKEN}
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/admin-auth';
import type { ApiResponse } from '@/shared/types';
// V2 优化（S-1）：原 funnel 接口类型在 API 路由和 dashboard 客户端重复定义，
// 改为统一引用 shared/admin-types.ts，避免字段不一致
import type { FunnelStep, FunnelData } from '@/shared/admin-types';

/** 漏斗步骤定义 */
const FUNNEL_STEPS: Array<{ step: string; label: string; event: string }> = [
  // W-2 修复：landing_visit 用独立事件（落地页 SSR beacon 上报），
  // 不复用 page_view（小程序首页也用 page_view，会重复计数）
  { step: 'landing_visit', label: '落地页访问', event: 'landing_visit' },
  { step: 'test_start', label: '开始测试', event: 'test_start' },
  { step: 'test_complete', label: '完成测试', event: 'test_complete' },
  { step: 'pair_join', label: '加入配对', event: 'pair_join' },
  { step: 'task_complete', label: '完成任务', event: 'task_complete' },
  { step: 'subscribe_success', label: '订阅成功', event: 'subscribe_success' },
];

export async function GET(request: NextRequest) {
  if (!verifyAdminToken(request)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: '未授权' },
      { status: 401 },
    );
  }

  try {
    const daysParam = request.nextUrl.searchParams.get('days');
    const days = Math.min(90, Math.max(1, parseInt(daysParam || '30', 10)));

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    // 一次性查询所有相关事件（按 event 分组聚合）
    const eventCounts = await prisma.trackEvent.groupBy({
      by: ['event'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { _all: true },
    });

    const countMap: Record<string, number> = {};
    for (const row of eventCounts) {
      countMap[row.event] = row._count._all;
    }

    // 构建漏斗（所有步骤统一用 countMap[event] 取值）
    const steps: FunnelStep[] = [];
    const landingCount = countMap[FUNNEL_STEPS[0].event] || 0;
    let prevCount = 0;
    for (let i = 0; i < FUNNEL_STEPS.length; i++) {
      const def = FUNNEL_STEPS[i];
      const count = countMap[def.event] || 0;
      const conversionRate = i === 0 ? 1.0 : (prevCount > 0 ? count / prevCount : 0);
      const overallRate = landingCount > 0 ? count / landingCount : 0;
      steps.push({
        step: def.step,
        label: def.label,
        count,
        conversionRate: Math.round(conversionRate * 1000) / 10, // 保留 1 位小数
        overallRate: Math.round(overallRate * 1000) / 10,
      });
      prevCount = count;
    }

    const data: FunnelData = {
      days,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      steps,
    };

    return NextResponse.json<ApiResponse<FunnelData>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询漏斗失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
