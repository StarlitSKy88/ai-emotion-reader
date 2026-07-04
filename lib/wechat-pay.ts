/**
 * 微信支付 V3 工具
 *
 * 流程：
 * 1. createOrder：调微信支付 V3 /v3/pay/transactions/jsapi 创建订单，拿到 prepay_id
 * 2. 用 prepay_id 签名生成小程序支付参数（timeStamp / nonceStr / package / signType / paySign）
 * 3. 用户在小程序端调 wx.requestPayment(payParams) 拉起支付
 * 4. 微信支付成功后回调 /api/wechat/pay/notify
 *
 * 环境变量：
 * - WECHAT_PAY_APPID：公众号/小程序 AppID
 * - WECHAT_PAY_MCHID：商户号
 * - WECHAT_PAY_API_KEY：商户 API V3 密钥（用于解密回调）
 * - WECHAT_PAY_SERIAL_NO：商户证书序列号
 * - WECHAT_PAY_PRIVATE_KEY：商户私钥（PEM 格式，多行用 \n 转义）
 * - WECHAT_PAY_NOTIFY_URL：支付回调地址（如 https://your-domain.com/api/wechat/pay/notify）
 *
 * 金额：39 元（分单位 3900）
 * 商品描述：「问心 AI 关系类型深度解读」
 *
 * 开发环境（缺环境变量时）返回 mock 数据，方便本地调试。
 */
import crypto from 'crypto';
import type { SubscriptionPlan } from '@/shared/types';

/** 小程序支付参数 */
export interface PayParams {
  timeStamp: string;
  nonceStr: string;
  /** package 字段，格式：prepay_id=xxx */
  package: string;
  signType: 'RSA';
  /** 签名 */
  paySign: string;
  /** 商户订单号（用于查单/回调匹配） */
  outTradeNo: string;
  /** prepay_id（mock 模式下为 mock_xxx） */
  prepayId: string;
}

/** 微信支付 V3 创建订单响应 */
interface JsapiOrderResponse {
  prepay_id: string;
}

/** @deprecated B-WC-1 修复：解锁功能已移除，V2 接入虚拟支付后恢复 */
/** 金额：39 元 = 3900 分 */
export const UNLOCK_AMOUNT_FEN = 3900;
/** @deprecated B-WC-1 修复：解锁功能已移除，V2 接入虚拟支付后恢复 */
export const UNLOCK_DESCRIPTION = '问心 AI 关系类型深度解读';

/**
 * 生成商户订单号：wx_{pairSessionId}
 *
 * 微信要求 out_trade_no 6-32 字符，cuid 默认 24 字符，
 * 加 'wx_' 前缀共 27 字符，符合长度限制。
 *
 * notify 路由可通过 parsePairSessionIdFromOutTradeNo 反解出 pairSessionId。
 */
function generateOutTradeNo(pairSessionId: string): string {
  return `wx_${pairSessionId}`.slice(0, 32);
}

/**
 * 从 out_trade_no 反解 pairSessionId
 */
export function parsePairSessionIdFromOutTradeNo(outTradeNo: string): string | null {
  if (!outTradeNo.startsWith('wx_')) return null;
  return outTradeNo.slice(3) || null;
}

/**
 * 用商户私钥对字符串做 RSA-SHA256 签名，返回 Base64
 */
function signWithPrivateKey(privateKeyPem: string, message: string): string {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message, 'utf8');
  return sign.sign(privateKeyPem, 'base64');
}

/**
 * 构造 V3 Authorization 头
 * 格式：WECHATPAY2-SHA256-RSA2048 mchid="...",nonce_str="...",timestamp="...",serial_no="...",signature="..."
 */
function buildAuthorizationHeader(
  method: string,
  url: string,
  body: string,
  mchid: string,
  serialNo: string,
  privateKeyPem: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  // 签名串：HTTP方法\n请求URL\n时间戳\n随机串\n请求体\n
  const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`;
  const signature = signWithPrivateKey(privateKeyPem, message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${mchid}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`;
}

/**
 * 创建微信支付订单，返回小程序支付参数
 *
 * @param pairSessionId 配对会话 ID（用于 out_trade_no 和回调匹配）
 * @param openid 用户 openid（小程序支付必须）
 * @returns PayParams
 */
export async function createOrder(
  pairSessionId: string,
  openid: string,
): Promise<PayParams> {
  const appid = process.env.WECHAT_PAY_APPID;
  const mchid = process.env.WECHAT_PAY_MCHID;
  const privateKeyEnv = process.env.WECHAT_PAY_PRIVATE_KEY;
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
  const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL;

  // 开发环境：缺任一环境变量则返回 mock
  const missingConfig =
    !appid || !mchid || !privateKeyEnv || !serialNo || !notifyUrl;
  if (missingConfig) {
    const mockPrepayId = `mock_${Date.now()}`;
    return {
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: crypto.randomBytes(16).toString('hex'),
      package: `prepay_id=${mockPrepayId}`,
      signType: 'RSA',
      paySign: 'mock_sign',
      outTradeNo: generateOutTradeNo(pairSessionId),
      prepayId: mockPrepayId,
    };
  }

  // 私钥 PEM：env 里的 \n 转回真实换行
  const privateKeyPem = privateKeyEnv.replace(/\\n/g, '\n');

  const outTradeNo = generateOutTradeNo(pairSessionId);
  const requestBody = JSON.stringify({
    appid,
    mchid,
    description: UNLOCK_DESCRIPTION,
    out_trade_no: outTradeNo,
    notify_url: notifyUrl,
    amount: {
      total: UNLOCK_AMOUNT_FEN,
      currency: 'CNY',
    },
    payer: {
      openid,
    },
  });

  // V3 API URL（仅路径部分用于签名，完整 URL 用于 fetch）
  const apiPath = '/v3/pay/transactions/jsapi';
  const apiUrl = `https://api.mch.weixin.qq.com${apiPath}`;

  const authorization = buildAuthorizationHeader(
    'POST',
    apiPath,
    requestBody,
    mchid,
    serialNo,
    privateKeyPem,
  );

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authorization,
    },
    body: requestBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`微信支付下单失败 (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as JsapiOrderResponse;
  const prepayId = data.prepay_id;

  // 生成小程序支付参数签名
  // 签名串：appId\ntimeStamp\nnonceStr\npackage\n
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const pkg = `prepay_id=${prepayId}`;
  const signMessage = `${appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const paySign = signWithPrivateKey(privateKeyPem, signMessage);

  return {
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign,
    outTradeNo,
    prepayId,
  };
}

/**
 * 校验是否处于 mock 模式（缺支付环境变量）
 */
export function isMockPayMode(): boolean {
  return (
    !process.env.WECHAT_PAY_APPID ||
    !process.env.WECHAT_PAY_MCHID ||
    !process.env.WECHAT_PAY_PRIVATE_KEY ||
    !process.env.WECHAT_PAY_SERIAL_NO ||
    !process.env.WECHAT_PAY_NOTIFY_URL
  );
}

// =====================================================================
// Phase 5.3 · 订阅支付扩展
// =====================================================================

/**
 * 订阅订单 out_trade_no 前缀（W-E-3 修复后格式）
 * - sm_：月订阅
 * - sy_：年订阅
 *
 * 回调路由根据前缀判断 plan，反解 userId。
 *
 * W-E-3 修复：加时间戳后缀防撞单
 * 微信要求 out_trade_no 6-32 字符：
 * - sm_ (3) + cuid (24) + 时间戳 base36 后 3 位 (3) = 30 字符 ✓
 * - sy_ (3) + cuid (24) + 时间戳 base36 后 3 位 (3) = 30 字符 ✓
 *
 * 时间戳 base36 后 3 位 ≈ 46656 种组合，单用户 46656 次订阅内不撞单，
 * 远超实际订阅频次，撞单概率可忽略。
 *
 * 兼容：parseSubscriptionFromOutTradeNo 同时识别旧格式 subm_/suby_，
 * 确保 W-E-3 修复前已付款订单的回调仍能正确反解。
 */
const SUBSCRIPTION_PREFIX: Record<SubscriptionPlan, string> = {
  monthly: 'sm_',
  yearly: 'sy_',
};

/**
 * 生成订阅订单 out_trade_no（W-E-3 修复：加时间戳防撞单）
 */
function generateSubscriptionOutTradeNo(
  userId: string,
  plan: SubscriptionPlan,
): string {
  // W-E-3 修复：同用户多次订阅时，旧格式 subm_{userId} 会撞 out_trade_no 唯一约束被微信拒
  // 新格式：sm_{userId 24 字符}{ts base36 后 3 位} = 30 字符 ≤ 32 ✓
  const ts = Date.now().toString(36).slice(-3);
  return `${SUBSCRIPTION_PREFIX[plan]}${userId}${ts}`.slice(0, 32);
}

/**
 * 从 out_trade_no 反解订阅信息
 *
 * W-E-3 修复后格式：sm_{userId 24 字符}{ts 3 位}
 *   - 取 slice(3, -3) 得到中间的 userId
 *
 * 兼容 W-E-3 修复前的旧格式：subm_{userId} / suby_{userId}
 *   - 旧订单回调时仍能正确反解，避免已付款订单无法续期
 *
 * @returns { userId, plan } 或 null（非订阅订单）
 */
export function parseSubscriptionFromOutTradeNo(
  outTradeNo: string,
): { userId: string; plan: SubscriptionPlan } | null {
  // W-E-3 修复后新格式：sm_{userId}{ts3} / sy_{userId}{ts3}
  if (outTradeNo.startsWith('sm_')) {
    return { userId: outTradeNo.slice(3, -3), plan: 'monthly' };
  }
  if (outTradeNo.startsWith('sy_')) {
    return { userId: outTradeNo.slice(3, -3), plan: 'yearly' };
  }
  // 兼容旧格式（W-E-3 修复前的已付款订单回调）
  if (outTradeNo.startsWith('subm_')) {
    return { userId: outTradeNo.slice(5), plan: 'monthly' };
  }
  if (outTradeNo.startsWith('suby_')) {
    return { userId: outTradeNo.slice(5), plan: 'yearly' };
  }
  return null;
}

/**
 * 创建订阅支付订单
 *
 * 与 createOrder 的区别：
 * - 金额按 plan 区分（3900 月 / 29800 年）
 * - 描述按 plan 区分
 * - out_trade_no 编码 userId 和 plan，回调时反解
 * - notify_url 用 WECHAT_PAY_SUBSCRIPTION_NOTIFY_URL（独立于解锁回调）
 *
 * @param userId 用户 ID
 * @param plan 订阅套餐
 * @param openid 用户 openid
 * @returns PayParams
 */
export async function createSubscriptionOrder(
  userId: string,
  plan: SubscriptionPlan,
  openid: string,
): Promise<PayParams> {
  const appid = process.env.WECHAT_PAY_APPID;
  const mchid = process.env.WECHAT_PAY_MCHID;
  const privateKeyEnv = process.env.WECHAT_PAY_PRIVATE_KEY;
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO;
  // 订阅回调地址独立配置，未配置时回退到通用 NOTIFY_URL（开发环境）
  const notifyUrl =
    process.env.WECHAT_PAY_SUBSCRIPTION_NOTIFY_URL ||
    process.env.WECHAT_PAY_NOTIFY_URL;

  const amountFen = plan === 'monthly' ? 3900 : 29800;
  const description = plan === 'monthly' ? '问心 AI 月度订阅' : '问心 AI 年度订阅';

  // 开发环境：缺任一环境变量则返回 mock
  const missingConfig =
    !appid || !mchid || !privateKeyEnv || !serialNo || !notifyUrl;
  if (missingConfig) {
    const mockPrepayId = `mock_${Date.now()}`;
    return {
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: crypto.randomBytes(16).toString('hex'),
      package: `prepay_id=${mockPrepayId}`,
      signType: 'RSA',
      paySign: 'mock_sign',
      outTradeNo: generateSubscriptionOutTradeNo(userId, plan),
      prepayId: mockPrepayId,
    };
  }

  const privateKeyPem = privateKeyEnv.replace(/\\n/g, '\n');
  const outTradeNo = generateSubscriptionOutTradeNo(userId, plan);

  const requestBody = JSON.stringify({
    appid,
    mchid,
    description,
    out_trade_no: outTradeNo,
    notify_url: notifyUrl,
    amount: {
      total: amountFen,
      currency: 'CNY',
    },
    payer: {
      openid,
    },
  });

  const apiPath = '/v3/pay/transactions/jsapi';
  const apiUrl = `https://api.mch.weixin.qq.com${apiPath}`;

  const authorization = buildAuthorizationHeader(
    'POST',
    apiPath,
    requestBody,
    mchid,
    serialNo,
    privateKeyPem,
  );

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authorization,
    },
    body: requestBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`微信支付订阅下单失败 (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as JsapiOrderResponse;
  const prepayId = data.prepay_id;

  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const pkg = `prepay_id=${prepayId}`;
  const signMessage = `${appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const paySign = signWithPrivateKey(privateKeyPem, signMessage);

  return {
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign,
    outTradeNo,
    prepayId,
  };
}

/**
 * 校验订阅回调金额是否与套餐匹配
 * @param total 回调金额（分）
 * @param plan 套餐
 */
export function isValidSubscriptionAmount(
  total: number,
  plan: SubscriptionPlan,
): boolean {
  return total === (plan === 'monthly' ? 3900 : 29800);
}

/**
 * 解密微信支付回调 ciphertext（AES-256-GCM）
 *
 * @param resource 微信回调 resource 字段 { ciphertext, nonce, associated_data }
 * @param apiKey V3 API 密钥
 * @returns 解密后的资源对象 JSON
 */
export function decryptPayNotifyResource(
  resource: { ciphertext: string; nonce: string; associated_data?: string },
  apiKey: string,
): Record<string, unknown> {
  const key = Buffer.from(apiKey, 'utf8');
  const nonce = Buffer.from(resource.nonce, 'utf8');
  const associatedData = Buffer.from(resource.associated_data ?? '', 'utf8');
  const ciphertext = Buffer.from(resource.ciphertext, 'base64');

  // GCM 模式：ciphertext 最后 16 字节是 authTag
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encryptedData = ciphertext.subarray(0, ciphertext.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  decipher.setAAD(associatedData);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(decrypted) as Record<string, unknown>;
}

/**
 * 校验微信支付回调签名（Wechatpay-Signature）
 *
 * 微信支付 V3 规范：回调请求头携带 Wechatpay-Signature / Wechatpay-Timestamp /
 * Wechatpay-Serial / Wechatpay-Nonce，需用平台公钥对 `timestamp\nnonce\nbody\n` 做
 * RSA-SHA256 验签。
 *
 * 安全原则（fail-closed，W-S-3 修复）：
 * - 默认必须验签，不依赖 NODE_ENV 区分环境（开发环境也可能被外网回调攻击）
 * - 仅当显式设置 WECHAT_PAY_SKIP_SIGNATURE_CHECK=1 时跳过（仅本地调试用）
 * - 生产环境：必须有 WECHAT_PAY_PLATFORM_CERT_PEM，否则拒绝回调
 *   （避免攻击者伪造回调任意解锁 PairSession，关联 CLAUDE.md 5.26）
 *
 * @param headers 回调请求头（小写键名）
 * @param body 原始请求 body 字符串
 * @returns true=通过；false=拒绝
 */
export function verifyNotifySignature(
  headers: Record<string, string>,
  body: string,
): boolean {
  // W-S-3 修复：fail-closed，不再依赖 NODE_ENV 跳过验签
  // 显式开关：仅当 WECHAT_PAY_SKIP_SIGNATURE_CHECK=1 时跳过（仅本地调试用）
  if (process.env.WECHAT_PAY_SKIP_SIGNATURE_CHECK === '1') {
    console.warn('[微信支付回调] 跳过验签（WECHAT_PAY_SKIP_SIGNATURE_CHECK=1），仅本地调试用');
    return true;
  }

  const signature = headers['wechatpay-signature'];
  const timestamp = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  if (!signature || !timestamp || !nonce) {
    console.error('[微信支付回调] 缺少验签头，拒绝');
    return false;
  }

  // 修复 B-2：移除「临时放行」，改为真实 RSA-SHA256 验签
  // 平台公钥（PEM 格式，多行用 \n 转义）从环境变量读取
  const platformCertPem = process.env.WECHAT_PAY_PLATFORM_CERT_PEM;
  if (!platformCertPem) {
    // fail-closed：未配置平台公钥时拒绝，避免被伪造回调攻击
    console.error('[微信支付回调] 生产环境未配置 WECHAT_PAY_PLATFORM_CERT_PEM，拒绝回调');
    return false;
  }

  try {
    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(message, 'utf8');
    verifier.end();
    // signature 是 Base64 编码
    const signatureBuf = Buffer.from(signature, 'base64');
    return verifier.verify(platformCertPem, signatureBuf);
  } catch (err) {
    console.error('[微信支付回调] 验签异常，拒绝', err);
    return false;
  }
}
