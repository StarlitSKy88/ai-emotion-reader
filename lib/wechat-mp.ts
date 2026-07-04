/**
 * 微信小程序服务端工具（Phase 4.5）
 *
 * 提供：
 * - getAccessToken：获取小程序全局接口调用凭据（access_token），带进程内缓存
 * - sendSubscribeMessage：发送订阅消息（一次性下发）
 *
 * 微信订阅消息文档：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/subscribe-message/sendMessage.html
 *
 * 环境变量：
 * - WECHAT_MINIAPP_APPID：小程序 AppID
 * - WECHAT_MINIAPP_SECRET：小程序 AppSecret
 *
 * 缓存策略：access_token 有效期 7200s，进程内缓存 7000s（提前 200s 过期），
 * 多实例部署时建议改为 Redis 共享缓存（Phase 5+）。
 */

/** access_token 缓存 */
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

interface AccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

/**
 * 获取小程序全局 access_token（带缓存）
 *
 * @returns access_token 字符串
 * @throws 缺少环境变量 / 微信接口失败
 */
export async function getAccessToken(): Promise<string> {
  // 1. 缓存命中
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
    return cachedAccessToken.token;
  }

  const appid = process.env.WECHAT_MINIAPP_APPID;
  const secret = process.env.WECHAT_MINIAPP_SECRET;
  if (!appid || !secret) {
    throw new Error('WECHAT_MINIAPP_APPID 或 WECHAT_MINIAPP_SECRET 未配置');
  }

  // 2. 调用微信 cgi-bin/token 接口
  // V2 优化（S-3）：原 fetch 无超时，微信 API 偶发 hang 会拖垮 cron 批次；加 8s 超时
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json()) as AccessTokenResponse;

  if (data.errcode || !data.access_token) {
    throw new Error(
      `获取 access_token 失败：${data.errcode} ${data.errmsg || ''}`,
    );
  }

  // 3. 写缓存（提前 200s 过期）
  const expiresIn = data.expires_in || 7200;
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (expiresIn - 200) * 1000,
  };

  return cachedAccessToken.token;
}

/** 订阅消息 body 字段 */
export interface SubscribeMessageData {
  /** 模板字段名 → { value: 字符串值 } */
  [key: string]: { value: string };
}

/**
 * 发送订阅消息（一次性下发）
 *
 * @param touser 接收用户的 openid
 * @param templateId 微信订阅消息模板 ID
 * @param data 模板字段值
 * @param page 跳转小程序页面路径（如 'pages/tasks/index'）
 * @param miniprogramState 跳转小程序版本：developer/trial/release（正式版必填 release）
 * @returns { success, errcode?, errmsg? }
 *
 * W-7 修复：errcode 40001/42001（access_token 失效）时清缓存并重试一次
 */
export async function sendSubscribeMessage(
  touser: string,
  templateId: string,
  data: SubscribeMessageData,
  page?: string,
  miniprogramState: 'developer' | 'trial' | 'release' = 'release',
): Promise<{ success: boolean; errcode?: number; errmsg?: string }> {
  const result = await doSendSubscribeMessage(
    touser,
    templateId,
    data,
    page,
    miniprogramState,
  );

  // W-7：access_token 失效时清缓存并重试一次
  if (
    !result.success &&
    (result.errcode === 40001 || result.errcode === 42001)
  ) {
    cachedAccessToken = null;
    return doSendSubscribeMessage(
      touser,
      templateId,
      data,
      page,
      miniprogramState,
    );
  }
  return result;
}

/** 实际调用微信接口（不含重试逻辑） */
async function doSendSubscribeMessage(
  touser: string,
  templateId: string,
  data: SubscribeMessageData,
  page?: string,
  miniprogramState: 'developer' | 'trial' | 'release' = 'release',
): Promise<{ success: boolean; errcode?: number; errmsg?: string }> {
  const accessToken = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;

  const body: Record<string, unknown> = {
    touser,
    template_id: templateId,
    data,
    miniprogram_state: miniprogramState,
    lang: 'zh_CN',
  };
  if (page) {
    body.page = page;
  }

  // S-5：fetch 加 5s 超时，避免微信 API 慢时挂死
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const result = (await res.json()) as {
    errcode?: number;
    errmsg?: string;
  };

  // errcode=0 或无 errcode 表示成功
  if (result.errcode && result.errcode !== 0) {
    return { success: false, errcode: result.errcode, errmsg: result.errmsg };
  }
  return { success: true };
}

// ====================================================================
// 订阅消息模板配置
// ====================================================================

/**
 * 4.5.1 微信后台订阅消息模板
 *
 * 微信小程序订阅消息模板需在微信公众平台后台审核通过。
 * 这里通过环境变量注入 templateId，避免硬编码（不同小程序实例 ID 不同）。
 *
 * 场景：
 * - daily_task：每日任务提醒（早上 9:00 推送，提醒做今日任务）
 * - task_summary：双方完成总结（双方都完成后推送默契度总结）
 *
 * 环境变量：
 * - WECHAT_TMPL_DAILY_TASK：每日任务提醒模板 ID
 * - WECHAT_TMPL_TASK_SUMMARY：任务总结模板 ID
 *
 * 模板字段约定（在小程序后台申请模板时按此字段名配置）：
 *
 * daily_task 模板（建议字段）：
 * - thing1：任务标题（如「3 分钟拥抱」）
 * - thing2：任务描述（前 20 字截断）
 * - date3：日期（YYYY-MM-DD）
 *
 * task_summary 模板（建议字段）：
 * - thing1：今日任务标题
 * - number2：默契度（0-100）
 * - thing3：一句话总结（前 20 字截断）
 */
export type PushScene = 'daily_task' | 'task_summary';

/** 推送场景 → 微信模板 ID 解析 */
export function getTemplateIdByScene(scene: PushScene): string | null {
  switch (scene) {
    case 'daily_task':
      return process.env.WECHAT_TMPL_DAILY_TASK || null;
    case 'task_summary':
      return process.env.WECHAT_TMPL_TASK_SUMMARY || null;
    default:
      return null;
  }
}

/** PushScene 中文标签（用于日志） */
export const PUSH_SCENE_LABELS: Record<PushScene, string> = {
  daily_task: '每日任务提醒',
  task_summary: '任务总结',
};

// ====================================================================
// Phase 6.2 · 小程序码生成
// ====================================================================

/**
 * 小程序码生成结果
 */
export interface MiniProgramQRCodeResult {
  /** 图片二进制 Buffer（PNG 格式） */
  buffer: Buffer;
  /** MIME 类型 */
  contentType: 'image/png';
}

/**
 * 生成不限制数量的小程序码（wxacode.getUnlimited）
 *
 * 接口：https://api.weixin.qq.com/wxa/getwxacodeunlimit
 * 限制：scene 最长 32 字符；每个 scene 不限数量永久有效
 *
 * @param scene 场景值（最长 32 字符，仅 [a-zA-Z0-9!#$&'()*+,/:;=?@._~-]）
 * @param page 小程序页面路径（如 'pages/index/index'，必须已发布）
 * @param envVersion 要打开的小程序版本：release/trial/develop
 * @param width 二维码宽度（280-1280px，默认 430）
 * @returns { buffer, contentType }
 *
 * 错误处理：
 * - 40001 access_token 失效：清缓存重试一次（W-7 同款机制）
 * - 45009 调用频率超限：抛错由调用方降级
 * - 41030 page 路径不存在：抛错（需要先发布小程序版本）
 */
export async function getMiniProgramQRCode(
  scene: string,
  page: string,
  options?: {
    envVersion?: 'release' | 'trial' | 'develop';
    width?: number;
  },
): Promise<MiniProgramQRCodeResult> {
  const envVersion = options?.envVersion ?? 'release';
  const width = options?.width ?? 430;

  const result = await doGetMiniProgramQRCode(scene, page, envVersion, width);

  // access_token 失效时清缓存重试一次
  if (result.error && (result.errcode === 40001 || result.errcode === 42001)) {
    cachedAccessToken = null;
    const retry = await doGetMiniProgramQRCode(scene, page, envVersion, width);
    if (retry.error) {
      throw new Error(`生成小程序码失败：${retry.errcode} ${retry.errmsg}`);
    }
    return { buffer: retry.buffer!, contentType: 'image/png' };
  }

  if (result.error) {
    throw new Error(`生成小程序码失败：${result.errcode} ${result.errmsg}`);
  }

  return { buffer: result.buffer!, contentType: 'image/png' };
}

/** 实际调用微信接口（不含重试逻辑） */
async function doGetMiniProgramQRCode(
  scene: string,
  page: string,
  envVersion: 'release' | 'trial' | 'develop',
  width: number,
): Promise<{
  buffer?: Buffer;
  error?: boolean;
  errcode?: number;
  errmsg?: string;
}> {
  // scene 长度校验
  if (scene.length > 32) {
    return { error: true, errcode: -1, errmsg: 'scene 超过 32 字符限制' };
  }

  const accessToken = await getAccessToken();
  const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scene,
      page,
      env_version: envVersion,
      width,
      check_path: false, // 允许 page 未发布时也生成（trial 模式需要）
      auto_color: false,
      line_color: { r: 0, g: 0, b: 0 },
      is_hyaline: false,
    }),
    signal: AbortSignal.timeout(8000),
  });

  // 微信返回的可能图片二进制（成功）或 JSON 错误（失败）
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    // 错误响应
    const err = (await res.json()) as { errcode?: number; errmsg?: string };
    return { error: true, errcode: err.errcode, errmsg: err.errmsg };
  }

  // 图片二进制
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer) };
}

/**
 * 小程序码内存缓存（同一 scene + page 复用）
 * 缓存 1 小时，避免高频调用微信接口
 */
const qrcodeCache = new Map<string, { buffer: Buffer; expiresAt: number }>();
const QRCODE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时

/**
 * 带缓存的小程序码生成
 *
 * @param scene 场景值
 * @param page 页面路径
 * @returns { buffer, contentType }
 */
export async function getMiniProgramQRCodeWithCache(
  scene: string,
  page: string,
): Promise<MiniProgramQRCodeResult> {
  const cacheKey = `${scene}::${page}`;
  const cached = qrcodeCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { buffer: cached.buffer, contentType: 'image/png' };
  }

  const result = await getMiniProgramQRCode(scene, page);
  qrcodeCache.set(cacheKey, {
    buffer: result.buffer,
    expiresAt: Date.now() + QRCODE_CACHE_TTL_MS,
  });
  return result;
}

/** 清理小程序码缓存（测试用） */
export function clearQrCodeCache(): void {
  qrcodeCache.clear();
}
