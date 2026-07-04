/**
 * 报告分享（Phase 5.2.3）
 * POST /api/report/share
 *
 * body: { coupleId, range, variant }
 *
 * 作用：
 * 1. 记录分享事件到 ShareEvent（utm_source='report_card'）
 * 2. 返回分享卡片所需数据（标题 + 一句话寄语 + 完成率 + 默契度）
 *
 * 与 Phase 3 分享变体的区别：
 * - Phase 3 分享的是「关系类型结果」，variant 是 boast/selfmock/helpseek/mystery
 * - Phase 5 分享的是「成长报告」，variant 固定为 'progress'（突出进步感）
 *
 * 隐私保护：分享卡片不暴露对方信息，只暴露双方聚合数据
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { aggregateReport, generateReportId } from '@/lib/report';
import { getCoupleForUser } from '@/lib/task-service';
import type { ApiResponse, ReportRange } from '@/shared/types';

/** 分享卡片数据 */
interface ReportShareData {
  /** 报告 ID */
  reportId: string;
  /** 区间 */
  range: ReportRange;
  /** 区间标签（这周 / 近 30 天） */
  rangeLabel: string;
  /** 卡片标题（取自 narrative.title 或兜底） */
  title: string;
  /** 一句话寄语 */
  blessing: string;
  /** 双方完成率（百分比） */
  bothCompletionPercent: number;
  /** 平均默契度（可能为 null） */
  avgCompatibility: number | null;
  /** 连续打卡天数 */
  streakDays: number;
  /** 卡片变体 */
  variant: string;
}

const VALID_RANGES: ReportRange[] = ['7d', '30d'];

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as {
      coupleId?: string;
      range?: ReportRange;
      variant?: string;
    };

    if (!body.coupleId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 coupleId' },
        { status: 400 },
      );
    }

    const range: ReportRange =
      body.range && VALID_RANGES.includes(body.range) ? body.range : '7d';
    const variant = body.variant || 'progress';

    // 权限校验
    const couple = await getCoupleForUser(userId);
    if (!couple || couple.id !== body.coupleId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 聚合数据
    const aggregation = await aggregateReport(body.coupleId, range);

    // 读缓存报告标题
    const profile = (couple.profile ?? {}) as {
      reports?: Record<string, { narrative: { title: string; blessing: string }; endDate: string }>;
    };
    const cacheKey = `report_${range}_${aggregation.endDate}`;
    const cached = profile.reports?.[cacheKey];
    const title = cached?.narrative?.title || (
      range === '7d' ? '这周的关系足迹' : '近 30 天的关系足迹'
    );
    const blessing = cached?.narrative?.blessing || '愿你们继续看见彼此的努力';

    // 记录分享事件
    const pairSessionId = couple.pairSessionId;
    await prisma.shareEvent.create({
      data: {
        pairSessionId,
        sharerUserId: userId,
        utmSource: 'report_card',
        utmMedium: 'miniapp',
        utmCampaign: `report_${range}`,
        variant,
      },
    });

    const shareData: ReportShareData = {
      reportId: generateReportId(body.coupleId, range, aggregation.endDate),
      range,
      rangeLabel: range === '7d' ? '这周' : '近 30 天',
      title,
      blessing,
      bothCompletionPercent: Math.round(aggregation.bothCompletionRate * 100),
      avgCompatibility: aggregation.avgCompatibility,
      streakDays: aggregation.streakDays,
      variant,
    };

    return NextResponse.json<ApiResponse<ReportShareData>>({
      success: true,
      data: shareData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成分享卡片失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
