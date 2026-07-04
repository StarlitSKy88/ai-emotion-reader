import { PropsWithChildren } from 'react';
import Taro, { useLaunch } from '@tarojs/taro';
import { silentLogin } from './lib/auth';
import { handleScanEntry } from './lib/share';
import './app.scss';

function App({ children }: PropsWithChildren<Record<string, unknown>>) {
  useLaunch((options) => {
    console.log('问心 AI 小程序启动');
    // 启动时检查登录态，未登录则静默登录
    const token = Taro.getStorageSync('token');
    if (!token) {
      silentLogin();
    }
    // 扫码进入处理（小程序码 scene 参数在 options.query.scene）
    const redirect = handleScanEntry({
      scene: (options as { query?: { scene?: string } }).query?.scene,
    });
    if (redirect) {
      // 延迟跳转，确保首页已加载
      setTimeout(() => {
        Taro.redirectTo({ url: redirect });
      }, 100);
    }
  });

  return children;
}

export default App;
