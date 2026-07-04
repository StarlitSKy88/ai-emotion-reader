/**
 * 获取当前登录用户信息
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * 返回: { success: true, data: { userId, nickname, avatarUrl, gender } }
 *
 * 更新当前登录用户信息
 * PUT /api/auth/me
 * Header: Authorization: Bearer <token>
 * Body: { nickname?, avatarUrl?, gender?, age?, status? }
 * 返回: { success: true, data: { id, nickname, avatarUrl, gender, age, status } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { prisma } from '@/lib/prisma';
import type { ApiResponse, Gender } from '@/shared/types';

/** 允许更新的字段及其校验 */
interface UpdateBody {
  nickname?: string;
  avatarUrl?: string;
  gender?: string;
  age?: number;
  status?: string;
}

/** 合法性别枚举 */
const VALID_GENDERS: ReadonlySet<string> = new Set(['male', 'female', 'other']);

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthHeader(
      request.headers.get('authorization')
    );

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未登录或 token 无效' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        gender: true,
        age: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<typeof user>>({
      success: true,
      data: user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取用户信息失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthHeader(
      request.headers.get('authorization')
    );

    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未登录或 token 无效' },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as UpdateBody | null;
    if (!body) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '请求体格式错误' },
        { status: 400 }
      );
    }

    // 按字段校验并组装更新数据，未提供的不动
    const data: Record<string, unknown> = {};
    if (typeof body.nickname === 'string' && body.nickname.trim()) {
      data.nickname = body.nickname.trim();
    }
    if (typeof body.avatarUrl === 'string' && body.avatarUrl.trim()) {
      data.avatarUrl = body.avatarUrl.trim();
    }
    if (typeof body.gender === 'string') {
      if (!VALID_GENDERS.has(body.gender)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'gender 参数无效，仅支持 male / female / other' },
          { status: 400 }
        );
      }
      data.gender = body.gender as Gender;
    }
    if (typeof body.age === 'number' && Number.isFinite(body.age)) {
      if (body.age < 0 || body.age > 150) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'age 参数无效' },
          { status: 400 }
        );
      }
      data.age = Math.floor(body.age);
    }
    if (typeof body.status === 'string' && body.status.trim()) {
      data.status = body.status.trim();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '没有可更新的字段' },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        gender: true,
        age: true,
        status: true,
      },
    });

    return NextResponse.json<ApiResponse<typeof updated>>({
      success: true,
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新用户信息失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
