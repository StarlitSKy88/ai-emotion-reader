export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/test/index',
    'pages/result/index',
    'pages/tasks/index',
    'pages/profile/index',
    'pages/invite/index',
    'pages/invite/join',
    'pages/type/detail',
    'pages/type/encyclopedia',
    'pages/task/detail',
    'pages/task/chat',
    'pages/subscription/index',
    'pages/crisis/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '问心 AI',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FAFAFA',
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#E8657E',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
      },
      {
        pagePath: 'pages/tasks/index',
        text: '任务',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
      },
    ],
  },
  // 分享配置：页面级分享在各页面 index.config.ts 中通过 enableShareAppMessage/enableShareTimeline 配置
});
