import type { UserConfigExport } from '@tarojs/cli';

export default {
  env: {
    NODE_ENV: '"production"',
  },
  defineConstants: {
    API_BASE_URL: '"https://api.wenxin-ai.com/api"',
    // TODO: 发布前替换为流量主后台申请的真实激励视频 adUnitId
    REWARDED_AD_UNIT_ID: '"adunit-xxxxxxxxxxxx"',
  },
  mini: {},
  h5: {
    /**
     * 生产环境若需要生产 H5，可在此处配置 publicPath 和部署域名
     * 当前主要产物为微信小程序，H5 仅作官网落地页保留
     */
  },
} satisfies UserConfigExport;
