import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    NODE_ENV: '"production"',
  },
  defineConstants: {
    API_BASE_URL: JSON.stringify(process.env.TARO_APP_API || 'https://wenxin.taomyst.top/api'),
    // V3 商业化:激励视频 adUnitId
    // - 阶段1(未申请流量主):留空字符串,代码走免费解锁路径(method=free)
    // - 阶段2/3:填流量主后台申请的真实 adUnitId
    // 从环境变量 TARO_APP_REWARDED_AD_ID 读取(编译时注入)
    REWARDED_AD_UNIT_ID: JSON.stringify(process.env.TARO_APP_REWARDED_AD_ID || ''),
  },
  mini: {},
  h5: {
    /**
     * 生产环境若需要生产 H5，可在此处配置 publicPath 和部署域名
     * 当前主要产物为微信小程序，H5 仅作官网落地页保留
     */
  },
} satisfies UserConfigExport;
