/**
 * 小程序请求封装
 * - 自动带 token
 * - 统一错误处理
 * - 统一响应格式 { success, data, error }
 */
import Taro from '@tarojs/taro';

/** 后端响应格式 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 请求配置 */
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, unknown>;
  /** 是否需要登录态（默认 true） */
  requireAuth?: boolean;
}

/** 拼接完整 URL */
function buildUrl(path: string): string {
  // API_BASE_URL 由 Taro 编译时注入（见 config/dev.ts、config/prod.ts）
  const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '') as string;
  if (path.startsWith('http')) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** 获取 token */
function getToken(): string {
  return Taro.getStorageSync('token') || '';
}

/** 通用请求函数 */
export async function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, requireAuth = true } = options;

  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    const token = getToken();
    if (!token) {
      // 跳转登录
      Taro.navigateTo({ url: '/pages/profile/index' });
      throw new Error('未登录');
    }
    header['Authorization'] = `Bearer ${token}`;
  }

  const res = await Taro.request({
    url: buildUrl(url),
    method,
    data,
    header,
  });

  // HTTP 状态码处理
  if (res.statusCode === 401) {
    Taro.removeStorageSync('token');
    Taro.navigateTo({ url: '/pages/profile/index' });
    throw new Error('登录已过期，请重新登录');
  }

  if (res.statusCode >= 400) {
    const msg = (res.data as ApiResponse)?.error || `请求失败 (${res.statusCode})`;
    throw new Error(msg);
  }

  const body = res.data as ApiResponse<T>;
  if (!body.success) {
    throw new Error(body.error || '请求失败');
  }

  return body.data as T;
}

/** 便捷方法 */
export const http = {
  get: <T>(url: string, requireAuth = true) =>
    request<T>({ url, method: 'GET', requireAuth }),

  post: <T>(url: string, data?: Record<string, unknown>, requireAuth = true) =>
    request<T>({ url, method: 'POST', data, requireAuth }),

  put: <T>(url: string, data?: Record<string, unknown>, requireAuth = true) =>
    request<T>({ url, method: 'PUT', data, requireAuth }),

  delete: <T>(url: string, requireAuth = true) =>
    request<T>({ url, method: 'DELETE', requireAuth }),
};
