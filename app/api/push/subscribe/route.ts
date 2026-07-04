/**
 * 订阅消息授权记录
 * POST /api/push/subscribe
 *
 * body: { templateId, scene, count? }
 *
 * 微信小程序订阅消息为「一次性订阅」：
 * - 用户每次点 wx.requestSubscribeMessage 同意 = 1 次推送配额
 * - 后端在此记录授权，cron 触发时 count > 0 才下发，下发后 count -= 1
 *
 * 同一 (userId, templateId, scene) 通过 @@unique 累加 count，
 * 避免同用户重复记录。
 *
 * 返回：{ success: true, data: { count: 累加后的总配额 } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { PushScene } from '@/lib/wechat-mp';
import type { ApiResponse } from '@/shared/types';

interface SubscribeBody {
  templateId?: string;
  scene?: PushScene;
  /** 本次授权增加的次数（默认 1） */
  count?: number;
}

interface SubscribeData {
  count: number;
}

const VALID_SCENES: PushScene[] = ['daily_task', 'task_summary'];

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

    const body = (await request.json()) as SubscribeBody;
    const templateId = body.templateId?.trim();
    const scene = body.scene;
    const addCount = Math.max(1, Math.min(body.count ?? 1, 10)); // 单次最多 +10

    if (!templateId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 templateId' },
        { status: 400 },
      );
    }
    if (!scene || !VALID_SCENES.includes(scene)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `无效 scene，可选：${VALID_SCENES.join(', ')}` },
        { status: 400 },
      );
    }

    // upsert：已存在累加 count，新建 count = addCount
    const record = await prisma.pushSubscription.upsert({
      where: {
        userId_templateId_scene: { userId, templateId, scene },
      },
      update: { count: { increment: addCount } },
      create: { userId, templateId, scene, count: addCount },
      select: { count: true },
    });

    return NextResponse.json<ApiResponse<SubscribeData>>({
      success: true,
      data: { count: record.count },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '订阅失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/push/subscribe
 * 查询当前用户各场景的剩余推送配额
 *
 * query: ?scene=daily_task （可选，不传则返回所有场景）
 */
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

    const scene = request.nextUrl.searchParams.get('scene') as PushScene | null;
    const where = scene ? { userId, scene } : { userId };
    const records = await prisma.pushSubscription.findMany({
      where,
      select: { templateId: true, scene: true, count: true },
    });

    return NextResponse.json<ApiResponse<{ records: typeof records }>>({
      success: true,
      data: { records },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
