/**
 * B 扫码加入
 * GET /api/pair/join/[testSessionId]
 *
 * B 扫描 A 的邀请码后调用，返回 A 的基本信息和路径选择。
 *
 * 返回：{
 *   inviterTestSessionId,
 *   inviterGender,
 *   inviterNickname?,
 *   inviterAvatar?,
 *   hasExistingPair: boolean,
 *   paths: ['as-partner', 'as-new-initiator']
 * }
 *
 * 路径：
 * - 'as-partner'：B 是 A 伴侣，开始答题配对（调 /api/test/submit 时带 inviterTestSessionId）
 * - 'as-new-initiator'：B 不是 A 伴侣，B 成为新发起人（调 /api/test/start 开始自己的测试）
 *
 * 校验：
 * 1. 需登录
 * 2. A 的 testSession 必须存在、已完成
 * 3. 是否已被配对（initiatorId @unique）→ hasExistingPair
 * 4. 不能自己邀请自己（A.userId === 当前 userId）→ 仍然返回，但前端会引导为 as-new-initiator
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { ApiResponse, Gender } from '@/shared/types';

interface JoinData {
  inviterTestSessionId: string;
  inviterGender: Gender;
  inviterNickname?: string;
  inviterAvatar?: string;
  /** A 是否已被配对（true 时 as-partner 路径不可用） */
  hasExistingPair: boolean;
  /** 当前用户是否就是 A 本人 */
  isSelf: boolean;
  /** 路径选项 */
  paths: Array<'as-partner' | 'as-new-initiator'>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { testSessionId: string } },
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

    const { testSessionId } = params;

    // 查 A 的 TestSession + A 的 User 信息
    const inviterSession = await prisma.testSession.findUnique({
      where: { id: testSessionId },
      select: {
        id: true,
        userId: true,
        gender: true,
        completedAt: true,
        user: {
          select: {
            nickname: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!inviterSession) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '邀请者的测试记录不存在' },
        { status: 404 },
      );
    }

    if (!inviterSession.completedAt) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '邀请者尚未完成测试' },
        { status: 400 },
      );
    }

    // 检查 A 是否已被配对（initiatorId @unique）
    const existingPair = await prisma.pairSession.findUnique({
      where: { initiatorId: testSessionId },
      select: { id: true },
    });
    const hasExistingPair = !!existingPair;

    // 是否自己邀请自己
    const isSelf = inviterSession.userId === userId;

    // 路径选项
    // - 已被配对或自邀请：只允许 as-new-initiator
    // - 否则：两条路径都可选
    const paths: Array<'as-partner' | 'as-new-initiator'> =
      hasExistingPair || isSelf
        ? ['as-new-initiator']
        : ['as-partner', 'as-new-initiator'];

    const data: JoinData = {
      inviterTestSessionId: testSessionId,
      inviterGender: inviterSession.gender as Gender,
      inviterNickname: inviterSession.user?.nickname ?? undefined,
      inviterAvatar: inviterSession.user?.avatarUrl ?? undefined,
      hasExistingPair,
      isSelf,
      paths,
    };

    return NextResponse.json<ApiResponse<JoinData>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '加入失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
