import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    NODE_ENV: '"development"',
  },
  defineConstants: {
    API_BASE_URL: '"http://localhost:3000/api"',
    // V3 商业化:激励视频 adUnitId
    // - 阶段1(未申请流量主):留空字符串,代码走免费解锁路径(method=free)
    // - 阶段2/3:填流量主后台申请的真实 adUnitId(如 'adunit-xxxxxxxxxxxx')
    // 微信官方测试 adUnitId 'adunit-xxxxxxxxxxxx' 仅在小程序开发者工具内有效,真机无效
    REWARDED_AD_UNIT_ID: JSON.stringify(process.env.TARO_APP_REWARDED_AD_ID || ''),
  },
  mini: {},
  h5: {
    devServer: {
      port: 10086,
      host: 'localhost',
    },
  },
} satisfies UserConfigExport;
