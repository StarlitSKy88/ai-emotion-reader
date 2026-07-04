/**
 * 微信小程序登录服务端工具
 *
 * 流程：
 * 1. 小程序调用 wx.login() 拿到 code
 * 2. 把 code 发到后端 /api/auth/wechat/login
 * 3. 后端用 code 换 openid + session_key（调用微信 jscode2session 接口）
 * 4. 后端根据 openid 查/建用户，签发 JWT
 * 5. 后端返回 JWT，小程序存到 storage，后续请求带上
 */
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

// W-5：生产环境强制要求 JWT_SECRET，开发环境保留默认值方便本地调试
const JWT_SECRET_VALUE = process.env.JWT_SECRET;
if (!JWT_SECRET_VALUE && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET 未配置，生产环境必须设置');
}
const JWT_SECRET = JWT_SECRET_VALUE || 'wenxin-ai-dev-secret-change-in-prod';
const JWT_EXPIRES_IN = '30d';

/** 微信 jscode2session 响应 */
interface WechatSessionResult {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * 用小程序 code 换 openid + session_key
 */
export async function code2session(code: string): Promise<WechatSessionResult> {
  const appid = process.env.WECHAT_MINIAPP_APPID;
  const secret = process.env.WECHAT_MINIAPP_SECRET;

  if (!appid || !secret) {
    throw new Error('WECHAT_MINIAPP_APPID 或 WECHAT_MINIAPP_SECRET 未配置');
  }

  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

  const res = await fetch(url);
  const data = (await res.json()) as WechatSessionResult;

  if (data.errcode) {
    throw new Error(`微信登录失败：${data.errcode} ${data.errmsg}`);
  }

  if (!data.openid) {
    throw new Error('微信登录失败：未返回 openid');
  }

  return data;
}

/**
 * 根据 openid 查/建用户，返回 userId
 */
export async function findOrCreateUserByOpenid(
  openid: string,
  unionid?: string,
  userInfo?: { nickname?: string; avatarUrl?: string; gender?: string }
): Promise<string> {
  // 先查
  const existing = await prisma.user.findUnique({
    where: { openid },
    select: { id: true },
  });

  if (existing) {
    // 已存在用户：可选更新昵称头像
    if (userInfo?.nickname || userInfo?.avatarUrl) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          nickname: userInfo.nickname ?? undefined,
          avatarUrl: userInfo.avatarUrl ?? undefined,
          gender: userInfo.gender ?? undefined,
        },
      });
    }
    return existing.id;
  }

  // 不存在：新建
  const newUser = await prisma.user.create({
    data: {
      email: `${openid}@wechat.miniapp`,  // 桩 email，NextAuth 需要
      openid,
      unionid,
      nickname: userInfo?.nickname,
      avatarUrl: userInfo?.avatarUrl,
      gender: userInfo?.gender,
    },
    select: { id: true },
  });

  return newUser.id;
}

/**
 * 签发 JWT
 */
export function signJwt(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * 验证 JWT，返回 userId 或 null
 */
export function verifyJwt(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

/**
 * 从请求头 Authorization 提取 userId
 *
 * @returns userId 或 null（未登录/无效 token）
 */
export function getUserIdFromAuthHeader(authHeader?: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) return null;
  return verifyJwt(match[1]);
}
