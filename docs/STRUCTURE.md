# 项目结构图

```
问心 AI (ai-emotion-reader)
│
├── 🌐 部署层
│   ├── EdgeOne Pages (生产环境)
│   ├── GitHub (StarlitSKy88/ai-emotion-reader)
│   └── Neon PostgreSQL (新加坡区域)
│
├── 💻 应用层 (Next.js 14 App Router)
│   ├── 📱 用户界面
│   │   ├── 首页 (表单 → 摘要 → 完整解读)
│   │   ├── 登录 / 注册
│   │   ├── 情绪档案 (待开发)
│   │   ├── 行动打卡 (待开发)
│   │   └── 订阅定价 (待开发)
│   │
│   └── 🔌 API 路由
│       ├── /api/auth/* (NextAuth.js)
│       ├── /api/summary (DeepSeek 摘要)
│       ├── /api/analyze (DeepSeek 完整解读)
│       └── /api/sessions/* (待开发)
│
├── 🗄️ 数据层
│   ├── users (用户表)
│   ├── sessions (对话会话)
│   ├── messages (对话消息)
│   ├── actions (行动打卡)
│   ├── mood_entries (情绪追踪)
│   └── NextAuth 标准表 (accounts/auths/tokens)
│
├── 🧠 AI 层
│   ├── DeepSeek-v4-flash (主模型)
│   ├── Prompt 模板 (情感解读/摘要/行动建议)
│   └── 上下文管理 (待开发)
│
├── 📧 服务层
│   ├── Resend (邮件服务)
│   └── NextAuth (认证服务)
│
└── 📚 文档层
    ├── README.md (项目说明)
    ├── DEPLOY.md (部署指南)
    ├── PROJECT.md (内部文档)
    └── STRUCTURE.md (本文件)
```

---

## 🎯 数据流向

```
用户输入
    ↓
[首页表单] → /api/summary → DeepSeek API → 流式返回
    ↓                              ↓
[摘要卡片]                   (300字 + 思考过滤)
    ↓
点击"解锁完整"
    ↓
/api/analyze → DeepSeek API → 流式返回
    ↓
[完整解读卡片]              (1500+字 + 思考过滤)
    ↓
显示微信引流 + 进阶服务
```

---

## 🔄 2 周重构路线图

```
Week 1: 核心交互 (Day 1-7)
├── ✅ Day 1: 数据库 + 认证 [已完成]
├── Day 2-3: 多轮对话 API + UI
├── Day 4-5: 情绪档案页面
├── Day 6-7: 行动打卡系统
│
Week 2: 商业化 (Day 8-14)
├── Day 8-9: 7天复盘 + 邮件推送
├── Day 10: 情绪曲线可视化
├── Day 11-12: 订阅付费系统
└── Day 13-14: 整合测试 + 部署
```

---

## 📊 当前完成度

```
████████████████░░░░ 70%

✅ 数据库     ✅ 认证       ✅ LLM 集成
✅ 摘要 API   ✅ 解读 API   ✅ 登录页面
✅ 邮件服务   ✅ 基础首页

⏳ 多轮对话 (核心)
⏳ 情绪档案 (核心)
⏳ 行动闭环 (核心)
⏳ 订阅付费 (核心)
```