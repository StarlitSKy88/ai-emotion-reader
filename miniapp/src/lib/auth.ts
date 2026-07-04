/**
 * 微信小程序登录态管理
 */
import Taro from '@tarojs/taro';
import { http } from './request';

interface LoginResponse {
  token: string;
  userId: string;
}

interface UserInfo {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
  gender: string | null;
  age: number | null;
  status: string | null;
}

/**
 * 静默登录（无 UI 提示）
 * 1. wx.login() 拿 code
 * 2. 调后端 /auth/wechat/login
 * 3. 存 token
 */
export async function silentLogin(): Promise<string | null> {
  try {
    const { code } = await Taro.login();
    if (!code) return null;

    const data = await http.post<LoginResponse>(
      '/auth/wechat/login',
      { code },
      false  // 不需要登录态
    );

    Taro.setStorageSync('token', data.token);
    Taro.setStorageSync('userId', data.userId);
    return data.token;
  } catch (err) {
    console.error('静默登录失败:', err);
    return null;
  }
}

/**
 * 用户授权登录（带 userInfo）
 * 用于「我的」页面用户主动授权昵称头像
 */
export async function loginWithUserInfo(userInfo: {
  nickname?: string;
  avatarUrl?: string;
  gender?: string;
}): Promise<string | null> {
  try {
    const { code } = await Taro.login();
    if (!code) return null;

    const data = await http.post<LoginResponse>(
      '/auth/wechat/login',
      { code, userInfo },
      false
    );

    Taro.setStorageSync('token', data.token);
    Taro.setStorageSync('userId', data.userId);
    return data.token;
  } catch (err) {
    console.error('授权登录失败:', err);
    return null;
  }
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<UserInfo | null> {
  try {
    return await http.get<UserInfo>('/auth/me');
  } catch {
    return null;
  }
}

/**
 * 退出登录
 */
export function logout(): void {
  Taro.removeStorageSync('token');
  Taro.removeStorageSync('userId');
}

/**
 * 检查是否已登录
 */
export function isLoggedIn(): boolean {
  return !!Taro.getStorageSync('token');
}
