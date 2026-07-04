/**
 * 微信小程序登录
 * POST /api/auth/wechat/login
 * body: { code: string, userInfo?: { nickname, avatarUrl, gender } }
 * 返回: { success: true, data: { token, userId } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { code2session, findOrCreateUserByOpenid, signJwt } from '@/lib/wechat-auth';
import type { ApiResponse } from '@/shared/types';

interface LoginRequestBody {
  code: string;
  userInfo?: {
    nickname?: string;
    avatarUrl?: string;
    gender?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequestBody;

    if (!body.code) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 code 参数' },
        { status: 400 }
      );
    }

    // 1. code 换 openid
    const session = await code2session(body.code);

    // 2. 查/建用户
    const userId = await findOrCreateUserByOpenid(
      session.openid!,
      session.unionid,
      body.userInfo
    );

    // 3. 签发 JWT
    const token = signJwt(userId);

    return NextResponse.json<ApiResponse<{ token: string; userId: string }>>({
      success: true,
      data: { token, userId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '登录失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
