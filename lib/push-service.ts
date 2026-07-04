/**
 * 推送服务（Phase 4.5 辅助）
 *
 * 把「场景 → 推送内容 → 用户 openid」的推送逻辑封装，
 * 上层调用方只需传 userId + 推送参数，无需关心：
 * - 查用户 openid
 * - 查 PushSubscription 配额
 * - 调微信接口
 * - 扣减 count
 *
 * 所有推送 fire-and-forget：失败不抛错，仅记日志，不影响主流程。
 */

import { prisma } from './prisma';
import {
  sendSubscribeMessage,
  getTemplateIdByScene,
  type PushScene,
  type SubscribeMessageData,
} from './wechat-mp';

/**
 * 给单个用户推送一条订阅消息
 *
 * @param userId 接收用户 ID
 * @param scene 推送场景（决定模板 ID 和扣减哪条订阅记录）
 * @param data 模板字段值
 * @param page 跳转小程序页面路径
 * @returns true=成功推送；false=未订阅/无 openid/推送失败（不抛错）
 */
export async function pushToUser(
  userId: string,
  scene: PushScene,
  data: SubscribeMessageData,
  page: string,
): Promise<boolean> {
  try {
    // 1. 查模板 ID
    const templateId = getTemplateIdByScene(scene);
    if (!templateId) {
      // 模板未配置，跳过
      return false;
    }

    // 2. 查用户 openid
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { openid: true },
    });
    if (!user?.openid) {
      return false;
    }

    // 3. 查订阅配额（count > 0）
    const sub = await prisma.pushSubscription.findUnique({
      where: {
        userId_templateId_scene: { userId, templateId, scene },
      },
      select: { count: true },
    });
    if (!sub || sub.count <= 0) {
      // 无配额，跳过（不报错）
      return false;
    }

    // 4. 调微信接口下发
    const sendResult = await sendSubscribeMessage(
      user.openid,
      templateId,
      data,
      page,
    );

    if (!sendResult.success) {
      // errcode 43101 = 用户未订阅/已退订 → 清空 count 避免重复尝试
      if (sendResult.errcode === 43101) {
        await prisma.pushSubscription.updateMany({
          where: { userId, templateId, scene },
          data: { count: 0 },
        });
      }
      return false;
    }

    // 5. 扣减配额（用 updateMany + count > 0 防并发超额扣减）
    await prisma.pushSubscription.updateMany({
      where: { userId, templateId, scene, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });

    return true;
  } catch (err) {
    // 推送失败不影响主流程，仅记日志
    console.error(
      `[push] 推送失败 scene=${scene} userId=${userId}`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * 给双方都推送（如 task_summary 场景）
 *
 * @param userIdA A 的 userId
 * @param userIdB B 的 userId
 * @param scene 推送场景
 * @param data 模板字段值
 * @param page 跳转页面
 */
export async function pushToBoth(
  userIdA: string,
  userIdB: string,
  scene: PushScene,
  data: SubscribeMessageData,
  page: string,
): Promise<void> {
  await Promise.allSettled([
    pushToUser(userIdA, scene, data, page),
    pushToUser(userIdB, scene, data, page),
  ]);
}
