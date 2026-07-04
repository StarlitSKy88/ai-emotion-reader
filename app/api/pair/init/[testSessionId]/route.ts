/**
 * A 获取邀请信息
 * GET /api/pair/init/[testSessionId]
 *
 * A 答完测试后调用，获取邀请所需信息（不含结果）。
 *
 * 返回：{ testSessionId, initiatorGender, invitePath, shareTitle, shareImageUrl }
 * 校验：
 * 1. 需登录
 * 2. testSessionId 必须是当前用户的
 * 3. TestSession 必须已完成（completedAt 非空）
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { ApiResponse, Gender } from '@/shared/types';

interface InitData {
  testSessionId: string;
  initiatorGender: Gender;
  /** B 点击后进入的测试页路径（带 inviterTestSessionId 和 inviterGender） */
  invitePath: string;
  /** 分享卡片标题 */
  shareTitle: string;
  /** 分享卡片图片 */
  shareImageUrl: string;
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

    const session = await prisma.testSession.findUnique({
      where: { id: testSessionId },
      select: {
        id: true,
        userId: true,
        gender: true,
        completedAt: true,
      },
    });

    if (!session) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '测试记录不存在' },
        { status: 404 },
      );
    }

    // 权限：必须是当前用户的 TestSession
    if (session.userId !== userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 必须已完成
    if (!session.completedAt) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '测试未完成，无法邀请' },
        { status: 400 },
      );
    }

    const initiatorGender = session.gender as Gender;
    const invitePath = `/pages/test/index?inviterTestSessionId=${testSessionId}&inviterGender=${initiatorGender}`;

    const data: InitData = {
      testSessionId,
      initiatorGender,
      invitePath,
      shareTitle: '我们来做一道情侣测试吧，看看你们的匹配度',
      shareImageUrl: '/assets/share/test-share.png',
    };

    return NextResponse.json<ApiResponse<InitData>>({
      success: true,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取邀请信息失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
