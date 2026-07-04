/**
 * 提交测试
 * POST /api/test/submit
 *
 * body: { gender, bankVersion, answers, openQuestionId, openAnswer, inviterTestSessionId? }
 *
 * 逻辑：
 * 1. 验证必填字段
 * 2. 用 calculateDimensionScores 算 6 维度分数（含版本校验）
 * 3. 答案完整性校验（W-6：拒绝 incomplete）
 * 4. B 模式（有 inviterTestSessionId）：
 *    a. 先校验 inviter 存在、未自配对（W-4）、未被配对
 *    b. 用 prisma.$transaction 原子创建 TestSession + PairSession（W-1：避免孤儿 TestSession）
 *    c. 返回 testSessionId + pairSessionId
 * 5. A 模式：仅创建 TestSession，返回 testSessionId
 *
 * 错误处理：
 * - 题库版本不匹配 → 400 "题库版本过期，请重新开始"
 * - 答案不完整 → 400 "答案不完整，漏答题目：…"
 * - inviterTestSessionId 不存在 → 400
 * - 自配对（inviter.userId === 当前 userId）→ 400 "不能与自己配对"
 * - inviter 已被配对过（initiatorId @unique 冲突）→ 409 "对方已配对过"
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { MALE_TEST_BANK } from '@/shared/test-bank-male';
import { FEMALE_TEST_BANK } from '@/shared/test-bank-female';
import { calculateDimensionScores } from '@/shared/scoring';
import { getGenderCombo } from '@/shared/gender-combo';
import { matchCoupleType } from '@/lib/type-matcher';
import { detectCrisis } from '@/lib/crisis-detector';
import type {
  ApiResponse,
  Gender,
  Answers,
  DimensionScores,
} from '@/shared/types';

interface SubmitBody {
  gender: Gender;
  bankVersion: string;
  answers: Answers;
  openQuestionId: string;
  openAnswer: string;
  /** B 模式才有：邀请者的 TestSessionId */
  inviterTestSessionId?: string;
}

interface SubmitData {
  testSessionId: string;
  /** B 模式下返回 */
  pairSessionId?: string;
  /** B-U-2/B-E-1 修复：危机检测结果，high 级别前端跳资源页 */
  crisisLevel?: 'high' | 'middle' | 'low';
}

/**
 * W-6：校验 dimensions 完整性（D1-D6 全部为数字）
 * 防止旧数据 dimensions={} 直接强转导致 matchCoupleType 内 NaN 写库
 */
function isValidDimensions(d: unknown): d is DimensionScores {
  if (!d || typeof d !== 'object') return false;
  const obj = d as Record<string, unknown>;
  return ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].every(
    (k) => typeof obj[k] === 'number' && !Number.isNaN(obj[k]),
  );
}

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

    const body = (await request.json()) as SubmitBody;

    // 1. 验证必填字段
    if (
      !body.gender ||
      !body.bankVersion ||
      !body.answers ||
      !body.openQuestionId ||
      !body.openAnswer
    ) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少必填字段' },
        { status: 400 },
      );
    }

    if (body.gender !== 'male' && body.gender !== 'female') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'gender 参数无效' },
        { status: 400 },
      );
    }

    // B-U-2/B-E-1 修复：开放题文本接入危机检测
    // high 级别前端跳资源页（不调 LLM），middle/low 正常流程
    const crisisLevel = detectCrisis(body.openAnswer).level;

    const testBank = body.gender === 'male' ? MALE_TEST_BANK : FEMALE_TEST_BANK;

    // 2. 计算 6 维度分数（含版本校验）
    const scoring = calculateDimensionScores(
      body.answers,
      testBank,
      body.bankVersion,
    );
    if (scoring.versionMismatch) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '题库版本过期，请重新开始' },
        { status: 400 },
      );
    }

    const dimensions: DimensionScores = scoring.scores;

    // 3. W-6：服务端校验答案完整性（拒绝 incomplete）
    if (scoring.incomplete) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: `答案不完整，漏答题目：${scoring.skippedQuestions.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // 4. B 模式：有 inviterTestSessionId
    //    先校验所有前置条件（不写库），再用事务原子创建 TestSession + PairSession
    //    （W-1：避免 PairSession 创建失败时留下孤儿 TestSession）
    if (body.inviterTestSessionId) {
      const inviter = await prisma.testSession.findUnique({
        where: { id: body.inviterTestSessionId },
      });

      if (!inviter) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '邀请者的测试记录不存在' },
          { status: 400 },
        );
      }

      // W-4：防自配对（A 拿自己的 testSessionId 邀请自己）
      if (inviter.userId === userId) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '不能与自己配对' },
          { status: 400 },
        );
      }

      // 检查 inviter 是否已被配对（initiatorId @unique）
      const existingPair = await prisma.pairSession.findUnique({
        where: { initiatorId: body.inviterTestSessionId },
        select: { id: true },
      });
      if (existingPair) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '对方已配对过' },
          { status: 409 },
        );
      }

      // 计算性别组合
      const genderCombo = getGenderCombo(
        inviter.gender as Gender,
        body.gender,
      );

      // Phase 3：调用类型匹配引擎，计算 matchedTypeCode / alternatives / compatibility
      // - dominantStyleA/B 暂不计算（需题库查找），传 undefined，让 classifyAttachment 仅按 D1 分数判断
      // - matchedTypeId 暂存 null，matchedTypeCode 存 code，result 路由用 matchedTypeCode 查 CoupleType
      const inviterDimensions = inviter.dimensions as DimensionScores;

      // W-6：校验 inviter / responder dimensions 完整性，旧数据 dimensions={} 直接强转会导致 NaN 写库
      if (!isValidDimensions(inviter.dimensions)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '邀请人测试数据异常，请重新发起测试' },
          { status: 400 },
        );
      }
      if (!isValidDimensions(dimensions)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: '你的测试数据异常，请重新测试' },
          { status: 400 },
        );
      }

      const matchResult = matchCoupleType(
        genderCombo,
        inviterDimensions,
        dimensions,
      );

      // W-1：用 prisma.$transaction 原子创建 TestSession + PairSession + Couple
      // 若 PairSession 创建失败（P2002 并发兜底），TestSession 也会回滚，避免孤儿会话
      // V2 修复：同时创建 Couple 记录，否则每日任务（getCoupleForUser）永远 404
      let testSessionId: string;
      let pairSessionId: string;
      try {
        const result = await prisma.$transaction(async (tx) => {
          const ts = await tx.testSession.create({
            data: {
              userId,
              answers: body.answers as Prisma.InputJsonValue,
              openQuestionId: body.openQuestionId,
              openAnswer: body.openAnswer,
              dimensions: dimensions as Prisma.InputJsonValue,
              gender: body.gender,
              bankVersion: body.bankVersion,
              completedAt: new Date(),
            },
          });
          const ps = await tx.pairSession.create({
            data: {
              initiatorId: body.inviterTestSessionId as string,
              responderId: ts.id,
              initiatorUserId: inviter.userId,
              responderUserId: userId,
              status: 'completed',
              genderCombo,
              dimensionsA: inviterDimensions as Prisma.InputJsonValue,
              dimensionsB: dimensions as Prisma.InputJsonValue,
              // Phase 3：类型匹配结果
              matchedTypeId: null, // 暂存 null，result 路由用 matchedTypeCode 查 CoupleType
              matchedTypeCode: matchResult.matched.code,
              alternatives: matchResult.alternatives.map((t) => t.code),
              compatibility: matchResult.compatibility,
              completedAt: new Date(),
              // B-WC-1 修复：MVP 阶段深度内容免费开放，配对完成即解锁
              unlocked: true,
            },
          });
          // V2 修复：配对完成同时创建 Couple 记录，每日任务/报告等功能依赖此表
          // partnerA = inviter（A 角色），partnerB = responder（B 角色）
          await tx.couple.create({
            data: {
              pairSessionId: ps.id,
              partnerAId: inviter.userId,
              partnerBId: userId,
              stage: 'dating',
              status: 'active',
            },
          });
          return { testSessionId: ts.id, pairSessionId: ps.id };
        });
        testSessionId = result.testSessionId;
        pairSessionId = result.pairSessionId;
      } catch (e) {
        // P2002 = unique constraint violation（并发场景下 inviter 被抢先配对）
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: '对方已配对过' },
            { status: 409 },
          );
        }
        throw e;
      }

      return NextResponse.json<ApiResponse<SubmitData>>({
        success: true,
        data: { testSessionId, pairSessionId, crisisLevel },
      });
    }

    // 5. A 模式：无 inviterTestSessionId，仅创建 TestSession
    const testSession = await prisma.testSession.create({
      data: {
        userId,
        answers: body.answers as Prisma.InputJsonValue,
        openQuestionId: body.openQuestionId,
        openAnswer: body.openAnswer,
        dimensions: dimensions as Prisma.InputJsonValue,
        gender: body.gender,
        bankVersion: body.bankVersion,
        completedAt: new Date(),
      },
    });

    return NextResponse.json<ApiResponse<SubmitData>>({
      success: true,
      data: { testSessionId: testSession.id, crisisLevel },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '提交失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
