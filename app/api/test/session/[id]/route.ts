/**
 * 查询测试会话详情
 * GET /api/test/session/[id]
 *
 * 返回 TestSession 详情：{ id, gender, bankVersion, answers, dimensions, openQuestionId, openAnswer, createdAt, completedAt }
 * 权限：只能查自己的 TestSession（userId 不匹配 → 403）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { ApiResponse, Answers, DimensionScores } from '@/shared/types';

interface SessionData {
  id: string;
  gender: string;
  bankVersion: string | null;
  answers: Answers;
  dimensions: DimensionScores;
  openQuestionId: string | null;
  openAnswer: string | null;
  createdAt: string;
  completedAt: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
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

    const { id } = params;

    const session = await prisma.testSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '测试记录不存在' },
        { status: 404 },
      );
    }

    // 权限：只能查自己的 TestSession
    if (session.userId !== userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    const data: SessionData = {
      id: session.id,
      gender: session.gender,
      bankVersion: session.bankVersion,
      answers: session.answers as Answers,
      dimensions: session.dimensions as DimensionScores,
      openQuestionId: session.openQuestionId,
      openAnswer: session.openAnswer,
      createdAt: session.createdAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
    };

    return NextResponse.json<ApiResponse<SessionData>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
