# 问心 AI - 项目内部文档

> 最后更新：2026-06-30
> 状态：MVP 阶段（Day 1 完成）

---

## 🎯 项目定位

**问心 AI** 是一个基于 AI 大模型的个性化情感解读工具。

**核心价值**：让用户通过简单的输入，获得深度个性化情感陪伴。

**不是**：算命、占卜、玄学工具
**而是**：基于 AI 心理学模型的情感成长伙伴

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────┐
│  EdgeOne Pages（部署）                       │
│  ┌──────────────────────────────────────┐  │
│  │  Next.js 14 App Router               │  │
│  │  ├── 前端组件（React + TypeScript）  │  │
│  │  ├── API 路由（Edge Runtime）        │  │
│  │  └── 认证（NextAuth.js + Prisma）    │  │
│  └──────────────────────────────────────┘  │
│              ↓ HTTPS                         │
│  ┌──────────────────────────────────────┐  │
│  │  Neon PostgreSQL（数据库）            │  │
│  │  └── Prisma 5.22.0 ORM              │  │
│  └──────────────────────────────────────┘  │
│              ↓ HTTPS                         │
│  ┌──────────────────────────────────────┐  │
│  │  DeepSeek API（AI 引擎）              │  │
│  │  └── deepseek-v4-flash 模型          │  │
│  └──────────────────────────────────────┘  │
│              ↓ HTTPS                         │
│  ┌──────────────────────────────────────┐  │
│  │  Resend（邮件服务）                   │  │
│  │  └── onboarding@resend.dev           │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
ai-emotion-reader/
├── app/                              # Next.js App Router
│   ├── api/                          # API 路由
│   │   ├── auth/
│   │   │   └── [...nextauth]/        # NextAuth 路由
│   │   │       └── route.ts
│   │   ├── analyze/                  # 完整解读 API
│   │   │   └── route.ts
│   │   └── summary/                  # 摘要 API
│   │       └── route.ts
│   ├── auth/                         # 认证页面
│   │   ├── signin/
│   │   │   └── page.tsx
│   │   └── verify/
│   │       └── page.tsx
│   ├── globals.css                   # 全局样式
│   ├── layout.tsx                    # 根布局
│   └── page.tsx                      # 首页
│
├── components/                       # React 组件
│   ├── EmotionForm.tsx               # 情感表单（待重构：聊天气泡）
│   └── ResultDisplay.tsx             # 结果展示（待重构：多轮对话）
│
├── lib/                              # 核心库
│   ├── auth.ts                       # NextAuth 配置
│   ├── llm.ts                        # LLM 客户端（DeepSeek）
│   ├── prisma.ts                     # Prisma 单例
│   └── prompts.ts                    # Prompt 模板
│
├── prisma/                           # 数据库
│   └── schema.prisma                 # 6 张表定义
│
├── .env.local                       # 环境变量（不提交）
├── .env.local.example               # 环境变量模板
│
├── README.md                         # 项目说明
├── DEPLOY.md                         # 部署指南
├── PROJECT.md                        # 本文档
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
└── .gitignore
```

---

## 🗄️ 数据库 Schema（6 张表）

### 1. `users` - 用户表
```typescript
{
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  age           Int?
  gender        String?
  status        String?
  preferences   Json      @default("{}")
  subscription  Json      @default("{}")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### 2. `sessions` - 对话会话
```typescript
{
  id           String
  userId       String
  title        String       // 自动生成
  context      Json         // 解读时的填表数据
  summary      String?      // AI 自动生成的摘要
  insights     Json         // 关键洞察列表
  emotion      String?      // 当前情绪标签
  topics       Json         // 话题标签
  status       String       // active / archived
  startedAt    DateTime
  lastMessageAt DateTime
  endedAt      DateTime?
}
```

### 3. `messages` - 对话消息
```typescript
{
  id        String
  sessionId String
  userId    String
  role      String       // user / assistant
  content   String       // 消息内容
  metadata  Json         // 元数据
  emotion   String?      // 情感标签
  topics    Json         // 话题标签
  timestamp DateTime
}
```

### 4. `actions` - 行动打卡
```typescript
{
  id              String
  userId          String
  sessionId       String?
  title           String
  description     String
  category        String    // self-awareness / relationship / career / health
  durationDays   Int        // 默认 7
  startDate       DateTime
  checkIns        Json       // 打卡记录数组
  completionRate  Float      // 完成率 0-1
  status          String    // active / completed / abandoned
  aiFeedback      String?
  createdAt       DateTime
  updatedAt       DateTime
}
```

### 5. `mood_entries` - 情绪追踪
```typescript
{
  id        String
  userId    String
  score     Int        // 1-10 情绪分数
  emotion   String     // 情绪标签
  note      String?
  date      DateTime
  createdAt DateTime
}
```

### 6. NextAuth.js 标准表
- `accounts` - OAuth 账号
- `authentications` - 邮箱验证记录
- `verification_tokens` - 验证码

---

## 🔑 环境变量

```bash
# LLM 配置
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash

# 数据库
DATABASE_URL=postgresql://...neon.tech/neondb

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...

# Resend 邮件
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev

# 网站元数据
NEXT_PUBLIC_SITE_NAME=问心 AI
NEXT_PUBLIC_WECHAT_ID=...
NEXT_PUBLIC_SITE_URL=...
```

---

## 🚀 API 路由

| 路径 | 方法 | 用途 | 状态 |
|------|------|------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 认证 | ✅ |
| `/api/summary` | POST | 生成 300 字摘要 | ✅ |
| `/api/analyze` | POST | 生成 1500+ 字完整解读 | ✅ |
| `/api/sessions` | POST/GET | 会话管理 | ⏳ 待开发 |
| `/api/sessions/[id]/messages` | POST/GET | 消息管理 | ⏳ 待开发 |
| `/api/actions` | POST/GET/PUT | 行动管理 | ⏳ 待开发 |
| `/api/mood` | POST | 情绪记录 | ⏳ 待开发 |
| `/api/subscribe` | POST | 订阅管理 | ⏳ 待开发 |

---

## 📱 页面路由

| 路径 | 用途 | 状态 |
|------|------|------|
| `/` | 首页（表单 + 解读结果） | ✅ 基础版本 |
| `/auth/signin` | 邮箱登录 | ✅ |
| `/auth/verify` | 验证邮箱提示 | ✅ |
| `/dashboard` | 情绪档案主页 | ⏳ 待开发 |
| `/session/[id]` | 对话详情页 | ⏳ 待开发 |
| `/actions` | 行动打卡列表 | ⏳ 待开发 |
| `/pricing` | 订阅定价 | ⏳ 待开发 |
| `/settings` | 用户设置 | ⏳ 待开发 |

---

## 🎨 设计系统

### 颜色
```
背景：#FAF8F5（暖米色）
文字：#0A0A0A（近黑）
深色块：#1A1F2E（深蓝黑）
强调：#D97706（暖橘色）
边框：#EDE7DC（细线）
```

### 字体
```
标题：Fraunces（衬线，文学感）
正文：Inter（无衬线，可读性）
小标签：JetBrains Mono（技术感）
```

### 设计原则
- ❌ 无星空背景、玻璃拟态、渐变、emoji
- ✅ 单列布局、大量留白、细线分隔
- ✅ 编辑叙事结构
- ✅ 流式响应（AI 输出）

---

## 📋 开发进度

### ✅ Day 1（已完成）
- [x] Neon 数据库接入
- [x] Prisma schema + 6 张表创建
- [x] NextAuth.js 邮箱认证
- [x] Resend 邮件服务
- [x] 登录/验证页面
- [x] 摘要/解读 API
- [x] 首页基础版本

### ⏳ Day 2-3（下一步）
- [ ] 会话管理 API（`/api/sessions`）
- [ ] 消息管理 API（`/api/sessions/[id]/messages`）
- [ ] 多轮对话 UI（聊天气泡）
- [ ] 上下文管理（保留最近 N 轮对话）
- [ ] AI 自动生成对话标题

### ⏳ Day 4-5
- [ ] 情绪档案页面（`/dashboard`）
- [ ] 历史对话时间轴
- [ ] 关键洞察汇总
- [ ] 情绪档案数据展示

### ⏳ Day 6-7
- [ ] 行动打卡系统
- [ ] 行动列表 UI
- [ ] 打卡按钮 + 进度追踪
- [ ] 7 天复盘流程

### ⏳ Day 8-9
- [ ] 7 天复盘邮件（Resend）
- [ ] 周报推送
- [ ] 用户主动关怀

### ⏳ Day 10
- [ ] 情绪曲线可视化（雷达图、趋势图）
- [ ] 数据看板

### ⏳ Day 11-12
- [ ] 订阅付费系统（Creem 集成）
- [ ] 定价页面
- [ ] 月度自动续费

### ⏳ Day 13-14
- [ ] 整合测试
- [ ] 性能优化
- [ ] 重新部署到 EdgeOne Pages

---

## 🐛 已知问题

1. **EdgeOne Pages 部署问题** - 之前的部署因环境变量未配置导致 API 失败
2. **首页缺乏产品介绍** - 需要添加 Hero、Features、Testimonials 等区块
3. **测试题太少** - 当前表单只有 1 个核心问题，需要增加更多维度
4. **页面布局不够精致** - 需要用 React Bits 组件提升视觉质量

---

## 📞 联系信息

- **GitHub**: https://github.com/StarlitSKy88/ai-emotion-reader
- **部署地址**: https://ai-emotion-reader-qcoedkqn.edgeone.run/
- **数据库**: Neon (wenxin-ai project)
- **邮件服务**: Resend
- **AI 模型**: DeepSeek v4-flash

---

## 🎯 立即要解决的 4 个问题

1. **增加更多测试题**（让 AI 解读更准确）
2. **添加产品介绍和案例**（首页需要详细介绍）
3. **升级页面布局**（用 React Bits 组件）
4. **实现多轮对话**（替代一次性报告）

---

最后更新：2026-06-30 by 蕾姆