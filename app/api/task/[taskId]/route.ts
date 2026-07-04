/**
 * 任务详情（Phase 4.3.2）
 * GET /api/task/[taskId]
 *
 * 返回任务详情 + 双方回应（myResponse + partnerResponse）
 * 权限：当前用户必须是任务所属 couple 的成员
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import {
  buildDailyTaskInfo,
  getCoupleForUser,
} from '@/lib/task-service';
import type { ApiResponse } from '@/shared/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } },
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

    const { taskId } = params;
    if (!taskId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 taskId 参数' },
        { status: 400 },
      );
    }

    // 查任务（含回应）
    const task = await prisma.dailyTask.findUnique({
      where: { id: taskId },
      include: { responses: true },
    });

    if (!task) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '任务不存在' },
        { status: 404 },
      );
    }

    // 权限：必须是 couple 成员
    const couple = await getCoupleForUser(userId);
    if (!couple || couple.id !== task.coupleId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '无权访问' },
        { status: 403 },
      );
    }

    // 返回 DailyTaskInfo（含双方回应详情）
    const data = buildDailyTaskInfo(task, userId, couple, true);
    return NextResponse.json<ApiResponse<typeof data>>({
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
