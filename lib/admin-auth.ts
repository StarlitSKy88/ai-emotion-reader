/**
 * Admin 鉴权（Phase 6.7/6.8）
 *
 * 简化方案：环境变量 ADMIN_TOKEN 校验
 * - 客户端在 Authorization 头中带 `Bearer ${ADMIN_TOKEN}`
 * - 服务端用 crypto.timingSafeEqual 常数时间对比，防止时序攻击
 *
 * V2 升级：改为 NextAuth + role 字段，或接入自建账号系统
 */
import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * 常数时间字符串比较（防止时序攻击泄露 token）
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * 校验 admin token
 *
 * @returns true=通过；false=拒绝
 */
export function verifyAdminToken(request: NextRequest): boolean {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!expectedToken) {
    // 未配置 ADMIN_TOKEN 时拒绝（fail-closed，避免 admin 路由裸奔）
    return false;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  return safeEqual(token, expectedToken);
}
