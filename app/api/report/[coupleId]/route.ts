/**
 * 成长报告（Phase 5.2.1 / 5.2.2）
 * GET /api/report/[coupleId]?range=7d|30d
 *
 * V3 商业化付费墙:
 * - 阶段1:所有报告免费
 * - 阶段2/3 未订阅 + 未 deep 解锁:只返回 1 天报告(最新一份,无 narrative)
 * - 阶段2/3 已订阅 或 deep 解锁(ad/pay):返回完整报告(含 LLM 叙事)
 *
 * 触发 LLM 时机：
 * - 已解锁用户首次访问该报告 → 调 LLM 生成 narrative，写入 Couple.profile.reports 缓存
 * - 后续访问直接读缓存
 *
 * 缓存键：`report_${range}_${endDate}`，存在 Couple.profile.reports 对象中
 * 失效条件：endDate 变化（即第二天访问时重新生成）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { chatCompletion } from '@/lib/llm';
import {
  buildReportPrompt,
  buildFallbackReport,
  REPORT_SYSTEM_PROMPT,
} from '@/lib/prompts';
import { aggregateReport, generateReportId } from '@/lib/report';
import {
  getCoupleForUser,
  parseJsonFromLlm,
} from '@/lib/task-service';
import {
  getCommercialStage,
  isUserSubscribed,
} from '@/lib/commercial-policy';
import type {
  ApiResponse,
  CoupleReport,
  ReportLLMResult,
  ReportRange,
} from '@/shared/types';

/** 允许的区间参数 */
const VALID_RANGES: ReportRange[] = ['7d', '30d'];

interface CoupleProfile {
  reports?: Record<string, { narrative: ReportLLMResult; generatedAt: string; endDate: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { coupleId: string } },
) {
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

    const { coupleId } = params;
    if (!coupleId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 coupleId 参数' },
        { status: 400 },
      );
    }

    // 校验 range 参数
    const rangeParam = request.nextUrl.searchParams.get('range') as ReportRange | null;
    const range: ReportRange =
      rangeParam && VALID_RANGES.includes(rangeParam) ? rangeParam : '7d';

    // 权限：必须是 couple 成员
    const couple = await getCoupleForUser(userId);
    if (!couple || couple.id !== coupleId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 1. 聚合数据
    const aggregation = await aggregateReport(coupleId, range);

    // 2. V3 付费墙校验
    // - 阶段1:全免费
    // - 阶段2/3:已订阅 或 deep 解锁(ad/pay) → 完整报告
    // - 否则:仅返回基础聚合 + 兜底 blessing(付费墙 CTA)
    const stage = getCommercialStage();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscription: true },
    });
    const isSubscribed = isUserSubscribed(user?.subscription);

    // 查 PairSession.deepUnlockMethod(V3 字段)
    const pairSession = couple.pairSessionId
      ? await prisma.pairSession.findUnique({
          where: { id: couple.pairSessionId },
          select: { deepUnlockMethod: true },
        })
      : null;
    const deepUnlockMethod = pairSession?.deepUnlockMethod;

    const canViewFullReport =
      stage === 'stage1' ||
      isSubscribed ||
      deepUnlockMethod === 'ad' ||
      deepUnlockMethod === 'pay';

    // 3. 未解锁:仅返回聚合数据 + 兜底 title + blessing(付费墙 CTA)
    if (!canViewFullReport) {
      const fallback = buildFallbackReport(range);
      const report: CoupleReport = {
        id: generateReportId(coupleId, range, aggregation.endDate),
        coupleId,
        range,
        startDate: aggregation.startDate,
        endDate: aggregation.endDate,
        aggregation,
        narrative: {
          title: fallback.title,
          narrative: '', // 免费版不返回叙事
          highlights: [],
          suggestions: [],
          blessing: fallback.blessing,
        },
        unlocked: false,
        generatedAt: new Date().toISOString(),
      };
      return NextResponse.json<ApiResponse<CoupleReport>>({
        success: true,
        data: report,
      });
    }

    // 4. 已解锁用户(阶段1/订阅/deep解锁):读缓存或调 LLM 生成 narrative
    const profile = (couple.profile ?? {}) as CoupleProfile;
    const cacheKey = `report_${range}_${aggregation.endDate}`;
    const cached = profile.reports?.[cacheKey];

    let narrative: ReportLLMResult;
    if (cached && cached.endDate === aggregation.endDate) {
      narrative = cached.narrative;
    } else {
      // 查询关系类型名称（getCoupleForUser 不含 coupleType 关联，单独查）
      let coupleTypeName: string | undefined;
      if (couple.pairSession?.matchedTypeId) {
        const coupleType = await prisma.coupleType.findUnique({
          where: { id: couple.pairSession.matchedTypeId },
          select: { name: true },
        });
        coupleTypeName = coupleType?.name;
      }
      try {
        const prompt = buildReportPrompt(aggregation, coupleTypeName);
        const raw = await chatCompletion(REPORT_SYSTEM_PROMPT, prompt, 1024);
        const parsed = parseJsonFromLlm<ReportLLMResult>(raw);
        if (parsed && parsed.title && parsed.narrative) {
          narrative = {
            title: parsed.title.slice(0, 30),
            narrative: parsed.narrative.slice(0, 800),
            highlights: Array.isArray(parsed.highlights)
              ? parsed.highlights.slice(0, 3).map((s) => String(s).slice(0, 100))
              : [],
            suggestions: Array.isArray(parsed.suggestions)
              ? parsed.suggestions.slice(0, 3).map((s) => String(s).slice(0, 100))
              : [],
            blessing: (parsed.blessing || '').slice(0, 50),
          };
        } else {
          narrative = buildFallbackReport(range);
        }
      } catch {
        narrative = buildFallbackReport(range);
      }

      // 写缓存（不阻塞返回）
      const updatedReports = {
        ...(profile.reports ?? {}),
        [cacheKey]: {
          narrative,
          generatedAt: new Date().toISOString(),
          endDate: aggregation.endDate,
        },
      };
      // 保留最近 10 份报告缓存，避免 profile 无限增长
      const reportEntries = Object.entries(updatedReports)
        .sort((a, b) => b[1].generatedAt.localeCompare(a[1].generatedAt))
        .slice(0, 10);
      const trimmedReports = Object.fromEntries(reportEntries);

      try {
        await prisma.couple.update({
          where: { id: coupleId },
          data: {
            profile: {
              ...profile,
              reports: trimmedReports,
            } as never,
          },
        });
      } catch {
        // 缓存写入失败不阻塞返回
      }
    }

    const report: CoupleReport = {
      id: generateReportId(coupleId, range, aggregation.endDate),
      coupleId,
      range,
      startDate: aggregation.startDate,
      endDate: aggregation.endDate,
      aggregation,
      narrative,
      unlocked: true,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse<CoupleReport>>({
      success: true,
      data: report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成报告失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
