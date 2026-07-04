import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    NODE_ENV: '"development"',
  },
  defineConstants: {
    API_BASE_URL: '"http://localhost:3000/api"',
    // 激励视频测试 adUnitId（微信官方提供，正式发布前需替换为真实 adUnitId）
    REWARDED_AD_UNIT_ID: '"adunit-xxxxxxxxxxxx"',
  },
  mini: {},
  h5: {
    devServer: {
      port: 10086,
      host: 'localhost',
    },
  },
} satisfies UserConfigExport;
