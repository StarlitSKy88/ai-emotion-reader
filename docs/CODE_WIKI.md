# 问心 AI · Code Wiki

> 本文档为 `ai-emotion-reader` 仓库的结构化代码百科，涵盖项目整体架构、模块职责、关键类与函数、依赖关系以及运行方式。
> 生成时间：2026-07-03 · 仓库版本：v1.0.0

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [整体架构](#3-整体架构)
4. [目录结构](#4-目录结构)
5. [核心模块职责](#5-核心模块职责)
6. [关键类与函数说明](#6-关键类与函数说明)
7. [数据流与请求生命周期](#7-数据流与请求生命周期)
8. [数据库模型（Prisma Schema）](#8-数据库模型prisma-schema)
9. [API 接口参考](#9-api-接口参考)
10. [前端页面与组件](#10-前端页面与组件)
11. [子项目与设计资源](#11-子项目与设计资源)
12. [依赖关系](#12-依赖关系)
13. [环境变量](#13-环境变量)
14. [项目运行方式](#14-项目运行方式)
15. [部署](#15-部署)

---

## 1. 项目概述

**问心 AI（ai-emotion-reader）** 是一个基于大语言模型的个性化情感解读工具。用户通过填写表单（基础信息、当下困扰、童年氛围、亲密关系模式、自我描述等），由 AI 生成 1500+ 字的深度情感解读报告，并以流式方式实时返回。

**核心定位**

- 不是算命 / 占卜 / 玄学工具，而是基于「AI 心理学模型」的情感陪伴伙伴。
- 默认接入 MiniMax-M3，支持一行配置切换任何 OpenAI 兼容模型（DeepSeek / Kimi / GLM / Qwen / GPT 等）。
- 商业模式：免费摘要（引流钩子）+ 付费完整解读 + 微信私域转化。

**当前阶段**：MVP 已完成核心链路（数据库、认证、摘要/解读 API、首页、登录、对话页），多轮对话、情绪档案、行动打卡、订阅付费等模块在规划中（详见 [PROJECT.md](../PROJECT.md)）。

---

## 2. 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 全栈框架 | Next.js 14.2.15（App Router） | React 18 + 服务端/边缘路由 |
| 语言 | TypeScript 5.6 | 全量类型安全 |
| 样式 | Tailwind CSS 3.4 + 自定义编辑风 CSS | 暖米色纸纹「编辑设计」风格 |
| 动画 | Framer Motion 12 + 自研 Canvas 组件 | BlurText / Aurora / ParticleTrail / Magnet / CountUp |
| 数据库 | PostgreSQL（Neon） | 通过 Prisma 6.19 访问 |
| ORM | Prisma 6.19 + `@prisma/client` | 单例封装于 [lib/prisma.ts](../lib/prisma.ts) |
| 认证 | NextAuth.js 4.24（JWT Session） | 邮箱魔法链接登录 |
| 邮件 | Resend 6.16 | 通过 SMTP / API 发送登录邮件 |
| LLM | OpenAI SDK 4.67 + 原生 fetch | 统一适配 OpenAI 与 Anthropic 协议 |
| Anthropic SDK | `@anthropic-ai/sdk` 0.30 | 预留（MiniMax Token 订阅 Key） |
| 运行时 | Edge Runtime（流式 API）+ Node.js Runtime（Prisma 路由） | 按路由声明 |
| 部署 | 腾讯云 EdgeOne Pages | GitHub 推送自动部署 |
| 子项目 | Vite + React 19（`lithos/`） | 独立的设计原型工程 |

---

## 3. 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                      EdgeOne Pages（部署层）                  │
│   GitHub 推送 → 自动构建 → 全球边缘节点 CDN                    │
└──────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴────────────────────────────────┐
│                  Next.js 14 App Router（应用层）              │
│                                                              │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐  │
│  │  前端 React    │   │  API Routes   │   │   认证层      │  │
│  │  (RSC + CSR)  │   │ (Edge/Node)   │   │ NextAuth+JWT  │  │
│  │  app/         │   │ app/api/      │   │ lib/auth.ts   │  │
│  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘  │
│          │                   │                   │          │
│          └──────────┬────────┴───────────────────┘          │
│                     ▼                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              lib/ 核心库                              │   │
│  │  llm.ts      统一 LLM 客户端（OpenAI/Anthropic 双协议）│   │
│  │  prompts.ts  Prompt 模板（摘要/完整解读/多轮对话）     │   │
│  │  prisma.ts   Prisma 单例                             │   │
│  │  auth.ts     NextAuth 配置 + Resend 邮件              │   │
│  └──────┬─────────────────┬──────────────────┬──────────┘   │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          ▼                 ▼                  ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │ Neon Postgres│   │ LLM API     │   │ Resend SMTP │
   │ (6 张表)     │   │ MiniMax-M3  │   │ 邮件服务     │
   │              │   │ /DeepSeek…  │   │             │
   └─────────────┘   └─────────────┘   └─────────────┘
```

**运行时分层**

- `runtime = "edge"`：流式 LLM 接口（`/api/analyze`、`/api/summary`、`/api/sessions/[id]/messages`），低延迟、全球分布。
- `runtime = "nodejs"`：需要 Prisma 的接口（`/api/sessions`、`/api/sessions/[id]`），因 Prisma 在 Edge 环境下受限。

---

## 4. 目录结构

```
ai-emotion-reader/
├── app/                              # Next.js App Router 主应用
│   ├── api/                          # 后端 API 路由
│   │   ├── analyze/route.ts          # 完整解读（流式，Edge）
│   │   ├── summary/route.ts          # 免费摘要（流式，Edge）
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth 入口
│   │   ├── sessions/route.ts         # 会话列表/创建（Node）
│   │   ├── sessions/[id]/route.ts    # 会话详情/更新/删除（Node）
│   │   └── sessions/[id]/messages/route.ts  # 消息收发（Edge）
│   ├── auth/signin/page.tsx          # 邮箱登录页
│   ├── auth/verify/page.tsx          # 验证邮箱提示页
│   ├── chat/[sessionId]/page.tsx     # 多轮对话页
│   ├── globals.css                   # 全局样式 + 编辑风组件类
│   ├── layout.tsx                    # 根布局 + Metadata
│   └── page.tsx                      # 首页（Hero + 表单 + 结果）
│
├── components/                       # React 组件
│   ├── animations/                   # 动画组件（ReactBits 风格）
│   │   ├── Aurora.tsx                # 极光背景（Canvas）
│   │   ├── BlurText.tsx              # 文字模糊渐显
│   │   ├── CountUp.tsx               # 数字递增
│   │   ├── Magnet.tsx                # 光标吸附
│   │   └── ParticleTrail.tsx         # 多层粒子轨迹
│   ├── ChatBubble.tsx                # 聊天气泡容器
│   ├── EmotionForm.tsx               # 三步情感表单
│   └── ResultDisplay.tsx             # 解读结果展示 + 引流
│
├── lib/                              # 核心业务库
│   ├── auth.ts                       # NextAuth 配置
│   ├── llm.ts                        # LLM 统一客户端
│   ├── prisma.ts                     # Prisma 单例
│   └── prompts.ts                    # Prompt 模板
│
├── prisma/
│   └── schema.prisma                 # 数据库 Schema（6 张表）
│
├── lithos/                           # 独立设计原型子项目（Vite + React 19）
│   ├── src/
│   │   ├── components/               # Hero/About/Features/Chat/...
│   │   ├── App.tsx                   # 路由入口
│   │   └── main.tsx
│   └── package.json
│
├── wenxin-ai-design/                 # 设计稿资源（HTML 静态稿）
├── wenxin-ai-barbiecore/             # 设计稿资源（备用配色）
│
├── docs/                             # 文档
│   ├── DESIGN_REFERENCES.md
│   └── STRUCTURE.md
│
├── .env.local.example                # 环境变量模板
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── README.md / PROJECT.md / DEPLOY.md
└── package.json
```

---

## 5. 核心模块职责

### 5.1 `lib/` — 核心业务库

| 文件 | 职责 |
|------|------|
| [lib/llm.ts](../lib/llm.ts) | 统一 LLM 客户端。自动识别 `LLM_BASE_URL` 是否含 `/anthropic`，分别走 OpenAI SDK 流式或原生 fetch Anthropic 流式；统一过滤 `reasoning_content` 与 `<think>` 标签；对外暴露 `streamFullAnalysis` / `streamSummary` 两个函数。 |
| [lib/prompts.ts](../lib/prompts.ts) | Prompt 模板库。定义 `UserInput` 接口与多张枚举映射表（性别/状态/童年/关系模式），提供 `buildFullPrompt`（1500-2000 字四段结构）、`buildSummaryPrompt`（280-380 字摘要）、`buildChatPrompt`（多轮对话）。 |
| [lib/prisma.ts](../lib/prisma.ts) | Prisma 单例。开发环境下将实例挂到 `globalThis` 防止 HMR 重复连接数据库。 |
| [lib/auth.ts](../lib/auth.ts) | NextAuth 配置。采用 `PrismaAdapter` + JWT Session（30 天），邮箱 Provider 走 Resend SMTP，自定义 HTML 邮件模板；`session` 回调中注入 `userId` 与 `subscription`。 |

### 5.2 `app/api/` — 后端路由

| 路由 | Runtime | 职责 |
|------|---------|------|
| `analyze/route.ts` | edge | 接收 `UserInput`，调用 `streamFullAnalysis`，返回 `text/plain` 流；GET 返回服务健康与 LLM 配置。 |
| `summary/route.ts` | edge | 接收 `UserInput`，调用 `streamSummary`，返回流式摘要。 |
| `sessions/route.ts` | nodejs | 会话 CRUD：GET 按 userId 拉取会话列表（≤50，按 lastMessageAt 倒序）；POST 创建会话。 |
| `sessions/[id]/route.ts` | nodejs | 单会话操作：GET 含消息列表；PATCH 更新标题/状态/摘要/洞察；DELETE 删除。 |
| `sessions/[id]/messages/route.ts` | edge | GET 拉取会话消息；POST 发送用户消息 → 取最近 10 条历史 → `buildChatPrompt` → 流式调用 LLM → 边返回边累积 → 流结束后落库 assistant 消息。 |
| `auth/[...nextauth]/route.ts` | — | 导出 NextAuth handler（GET/POST）。 |

### 5.3 `app/` — 页面

| 路径 | 文件 | 说明 |
|------|------|------|
| `/` | [app/page.tsx](../app/page.tsx) | 首页。三态机：`form → summary → full`。包含 Hero、方法论、创始人寄语、邮件订阅、表单、定价、FAQ、Footer。流式读取 `/api/summary` 与 `/api/analyze`。 |
| `/auth/signin` | [app/auth/signin/page.tsx](../app/auth/signin/page.tsx) | 邮箱登录，调用 `next-auth/react` 的 `signIn("email")`。 |
| `/auth/verify` | [app/auth/verify/page.tsx](../app/auth/verify/page.tsx) | 邮件发送后提示页，3 秒后自动跳回首页。 |
| `/chat/[sessionId]` | [app/chat/[sessionId]/page.tsx](../app/chat/[sessionId]/page.tsx) | 多轮对话页。加载会话历史，发送消息并以流式更新最后一条 AI 消息。 |

### 5.4 `components/` — UI 组件

| 组件 | 职责 |
|------|------|
| [EmotionForm.tsx](../components/EmotionForm.tsx) | 三步表单（基础信息 / 此刻困扰 / 深度了解），导出 `UserFormData`，含进度条与字段校验。 |
| [ResultDisplay.tsx](../components/ResultDisplay.tsx) | 展示摘要 + 解锁完整版引导卡 + 流式完整解读 + 微信引流 + 进阶套餐。 |
| [ChatBubble.tsx](../components/ChatBubble.tsx) | 聊天消息列表与输入框，Enter 发送 / Shift+Enter 换行，自动滚动到底。 |
| `animations/*` | 5 个动画组件，源自 ReactBits.dev，详见 [§10.2](#102-动画组件)。 |

### 5.5 `prisma/` — 数据库

[schema.prisma](../prisma/schema.prisma) 定义 6 张表，详见 [§8](#8-数据库模型prisma-schema)。

### 5.6 `lithos/` — 设计原型子项目

独立的 Vite + React 19 工程（不参与 Next.js 构建），作为视觉与交互原型。包含 `Hero / About / Features / Signin / Chat / Assessment / Profile` 等页面，使用 `react-router-dom` 路由、`framer-motion` 动画、`lucide-react` 图标。详见 [§11.1](#111-lithos-设计原型子项目)。

### 5.7 `wenxin-ai-design/` 与 `wenxin-ai-barbiecore/`

设计稿静态资源目录，含 `pages/*.html`、`colors_and_type.css`、`generation-tree.json`、`orchestration-summary.json` 与 `.design` 文件，是设计生成工具的产物，供前端实现参考。详见 [§11.2](#112-wenxin-ai-design--wenxin-ai-barbiecore-设计资源)。

---

## 6. 关键类与函数说明

### 6.1 `lib/llm.ts`

| 名称 | 类型 | 说明 |
|------|------|------|
| `config` | const | 读取 `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`，兼容旧变量名 `MINIMAX_API_KEY` / `DEEPSEEK_API_KEY`。 |
| `useAnthropicProtocol` | const | `baseURL.includes("/anthropic")` 判定协议分支。 |
| `openaiClient` | const | `new OpenAI({ apiKey, baseURL })`，OpenAI 兼容客户端。 |
| `SYSTEM_PROMPT` | const | 完整解读系统提示词，定义「问心 AI」角色与边界。 |
| `SUMMARY_SYSTEM_PROMPT` | const | 摘要专用短系统提示词。 |
| `streamOpenAI(system, user, maxTokens)` | async fn | OpenAI 协议流式生成器。维护 `buffer` 与 `inThinkBlock` 状态机过滤 `<think>...</think>` 标签，并跳过 `delta.reasoning_content`。返回 `AsyncIterable<string>`。 |
| `streamAnthropic(system, user, maxTokens)` | async fn | 原生 fetch 调用 Anthropic `/v1/messages`（SSE），解析 `content_block_delta` 事件，返回 `AsyncIterable<string>`。 |
| `streamFullAnalysis(input)` | async fn | 用 `buildFullPrompt` 组装 prompt，按协议分发，`maxTokens=4096`。 |
| `streamSummary(input)` | async fn | 用 `buildSummaryPrompt` 组装 prompt，`maxTokens=1024`。 |
| `currentLLMConfig` | export const | 暴露当前 provider/model/baseURL/protocol，供 `/api/analyze` GET 健康检查使用。 |

### 6.2 `lib/prompts.ts`

| 名称 | 类型 | 说明 |
|------|------|------|
| `UserInput` | interface | 表单数据契约：`name / gender / age / status / currentQuestion / childhoodTag / relationshipPattern / selfDescription / focusAreas[]`。 |
| `STATUS_MAP` / `GENDER_MAP` / `FOCUS_MAP` / `CHILDHOOD_MAP` / `RELATIONSHIP_MAP` | const | 英文枚举 → 中文标签映射。 |
| `translateInput(input)` | fn | 将 `UserInput` 翻译为中文展示对象，缺失值给默认。 |
| `buildFullPrompt(input)` | fn | 生成完整解读 prompt（四段：现状画像 300-400 / 深层洞察 600-800 / 可执行建议 400-500 / 温暖收尾 100-200），强制纯文本无 markdown。 |
| `buildSummaryPrompt(input)` | fn | 生成 280-380 字摘要 prompt，结尾留引流钩子。 |
| `buildChatPrompt(context, history, newMessage)` | fn | 多轮对话 prompt，注入用户基本信息与最近历史。 |
| `SYSTEM_PROMPT` | const | 导出的系统提示词（与 `llm.ts` 内的常量内容一致）。 |

### 6.3 `lib/auth.ts`

| 名称 | 类型 | 说明 |
|------|------|------|
| `authOptions` | export const | NextAuthOptions。`PrismaAdapter` + JWT（30 天）+ EmailProvider（Resend SMTP）。 |
| `sendVerificationRequest` | fn | 自定义邮件 HTML 模板（暖米色卡片 + 黑色胶囊按钮）。 |
| `callbacks.jwt` | fn | 首次登录将 `user.id` 写入 token。 |
| `callbacks.session` | fn | 将 `token.userId` 与查库得到的 `subscription` 注入 `session.user`。 |

### 6.4 `lib/prisma.ts`

| 名称 | 类型 | 说明 |
|------|------|------|
| `prisma` | export const | 全局单例 `PrismaClient`，dev 模式 log `error/warn`，prod 仅 `error`。 |

### 6.5 `components/EmotionForm.tsx`

| 名称 | 类型 | 说明 |
|------|------|------|
| `UserFormData` | export interface | 与 `lib/prompts.ts` 的 `UserInput` 字段一致的表单数据结构。 |
| `EmotionForm` | default fn | 三步表单组件。`step` 状态控制分步；`toggleFocus` 切换关注多选；`handleNext/handleBack` 步进；`handleSubmit` 提交并触发 `onSubmit` 回调。包含校验（name/age/currentQuestion≥10/selfDescription 非空）。 |

### 6.6 `components/ResultDisplay.tsx`

| 名称 | 类型 | 说明 |
|------|------|------|
| `ResultDisplay` | default fn | 接收 `summary / fullText / loading / userName / onRequestFull / wechatId`。三块渲染：摘要区 + 解锁引导卡（仅 `!fullText && !loading`）+ 流式完整解读区（含微信引流与套餐）。`handleCopy` 调用 Clipboard API。 |

### 6.7 `app/page.tsx`（首页）

| 名称 | 类型 | 说明 |
|------|------|------|
| `Stage` | type | `"form" \| "summary" \| "full"` 三态。 |
| `handleFormSubmit(data)` | fn | 提交表单 → POST `/api/summary` → 流式累加 `summary` → `setStage("summary")`。 |
| `handleRequestFull()` | fn | 点击「生成完整解读」→ POST `/api/analyze` → 流式累加 `fullText`。 |
| `handleReset()` | fn | 重置所有状态回到表单。 |

### 6.8 `app/api/sessions/[id]/messages/route.ts`

| 名称 | 类型 | 说明 |
|------|------|------|
| `POST(req, {params})` | fn | 发消息主流程：取最近 10 条历史 → 落库用户消息 → 更新会话时间 → `buildChatPrompt` → 流式调用 LLM → 边返回边累积 → 流结束后落库 assistant 消息。 |
| `streamFullAnalysisWithChat(prompt)` | fn | 内部包装函数，将对话 prompt 塞进 `currentQuestion` 字段调用 `streamFullAnalysis`（临时方案，待与 `buildChatPrompt` 解耦）。 |

---

## 7. 数据流与请求生命周期

### 7.1 一次性解读流程（核心链路）

```
用户填写三步表单
      │
      ▼
EmotionForm.handleSubmit
      │  POST /api/summary  (body: UserInput)
      ▼
summary/route.ts (edge)
      │  streamSummary(input)
      ▼
lib/llm.ts  ──► buildSummaryPrompt ──► streamOpenAI/Anthropic
      │                                          │
      │  ◄──────── AsyncIterable<string> ────────┘
      ▼
ReadableStream → text/plain 流
      │
      ▼
page.tsx reader.read() 循环 → setSummary(accumulated)
      │
      ▼
ResultDisplay 渲染摘要 + 「解锁完整版」按钮
      │  用户点击
      ▼
handleRequestFull → POST /api/analyze (同样流式)
      │
      ▼
analyze/route.ts → streamFullAnalysis(input) → 1500+ 字流式输出
      │
      ▼
完整解读区 + 微信引流 + 套餐卡片
```

### 7.2 多轮对话流程

```
/chat/[sessionId] 页面加载
      │  GET /api/sessions/[id]
      ▼
sessions/[id]/route.ts (nodejs) → prisma.session.findUnique({include: messages})
      │
      ▼
渲染历史消息
      │  用户发送消息
      ▼
POST /api/sessions/[id]/messages
      │  1. prisma.message.findMany (最近 10 条)
      │  2. prisma.message.create (用户消息)
      │  3. prisma.session.update (lastMessageAt)
      │  4. buildChatPrompt(context, history, content)
      │  5. streamFullAnalysis → 流式返回
      │  6. 流结束后 prisma.message.create (assistant 消息)
      ▼
ChatPage 边收流边更新最后一条 AI 消息内容
```

### 7.3 认证流程

```
/signin 输入邮箱 → signIn("email", {email, callbackUrl:"/"})
      │
      ▼
NextAuth → EmailProvider.sendVerificationRequest
      │  → Resend SMTP 发送 HTML 邮件（含魔法链接）
      ▼
用户点击邮件链接 → /api/auth/callback/email
      │  → PrismaAdapter 创建/更新 User + Account
      │  → JWT 签发（含 userId）
      ▼
回调到 / → session.user.id / subscription 就绪
```

---

## 8. 数据库模型（Prisma Schema）

[schema.prisma](../prisma/schema.prisma) 共 7 个 model，分四组：

### 8.1 用户系统

**User**（`users`）— 核心用户表
- `id`（cuid 主键）、`email`（唯一）、`emailVerified`、`name`、`image`
- `age`、`gender`、`status`（情感状态）
- `preferences`（JSON，默认 `{}`）、`subscription`（JSON，默认 `{}`）
- `createdAt`、`updatedAt`
- 关联：`sessions / messages / actions / accounts / authentications`

**Account**（`accounts`）— NextAuth OAuth 账号表（标准字段，`@@unique([provider, providerAccountId])`）

**Authentication**（`authentications`）— 邮箱验证记录（含 `code`）

**VerificationToken**（`verification_tokens`）— 验证码 token（`@@unique([identifier, token])`）

### 8.2 对话系统

**Session**（`sessions`）— 对话会话
- `id`、`userId`、`title`（自动生成）
- `context`（JSON，解读时的填表数据）、`summary`、`insights`（JSON 数组）
- `emotion`、`topics`（JSON 数组）、`status`（`active`/`archived`）
- `startedAt`、`lastMessageAt`、`endedAt`
- 索引：`userId`、`status`、`lastMessageAt`

**Message**（`messages`）— 对话消息
- `id`、`sessionId`、`userId`、`role`（`user`/`assistant`）
- `content`（Text）、`metadata`（JSON）、`emotion`、`topics`（JSON）
- `timestamp`
- 索引：`[sessionId, timestamp]`、`userId`

### 8.3 行动系统

**Action**（`actions`）— 行动打卡
- `userId`、`sessionId?`、`title`、`description`
- `category`（`self-awareness`/`relationship`/`career`/`health`）
- `durationDays`（默认 7）、`startDate`、`checkIns`（JSON 数组）
- `completionRate`（0-1）、`status`、`aiFeedback`
- 索引：`userId`、`status`、`sessionId`

### 8.4 情绪追踪

**MoodEntry**（`mood_entries`）— 情绪记录
- `userId`、`score`（1-10）、`emotion`、`note?`、`date`
- 索引：`[userId, date]`

> 说明：`Action` 与 `MoodEntry` 模型已定义但对应 API 尚未实现（见 PROJECT.md 路线图）。

---

## 9. API 接口参考

| 方法 | 路径 | Runtime | 入参 | 返回 |
|------|------|---------|------|------|
| GET | `/api/analyze` | edge | — | `{status, service, version, llm}` 健康检查 |
| POST | `/api/analyze` | edge | `UserInput` | `text/plain` 流（1500+ 字） |
| POST | `/api/summary` | edge | `UserInput` | `text/plain` 流（280-380 字） |
| GET/POST | `/api/auth/*` | — | NextAuth 标准 | NextAuth 处理 |
| GET | `/api/sessions?userId=&status=` | nodejs | query | `{sessions[]}`（≤50） |
| POST | `/api/sessions` | nodejs | `{userId, title?, context?}` | `{session}` |
| GET | `/api/sessions/[id]` | nodejs | — | `{session{...,messages[]}}` |
| PATCH | `/api/sessions/[id]` | nodejs | `{title?,status?,summary?,insights?}` | `{session}` |
| DELETE | `/api/sessions/[id]` | nodejs | — | `{success:true}` |
| GET | `/api/sessions/[id]/messages` | edge | — | `{messages[]}` |
| POST | `/api/sessions/[id]/messages` | edge | `{userId, content, context?}` | `text/plain` 流 |

**校验规则**
- `analyze`：`currentQuestion` 长度 5-2000。
- `summary`：`currentQuestion` 长度 ≥ 5。
- `messages` POST：`userId` 与 `content` 必填。

**流式响应头**
```
Content-Type: text/plain; charset=utf-8
Cache-Control: no-cache
X-Accel-Buffering: no   # 禁用 EdgeOne/Nginx 缓冲，保证流式
```

---

## 10. 前端页面与组件

### 10.1 主要页面

**首页 [app/page.tsx](../app/page.tsx)** — 单文件实现完整首屏：

- 顶部导航（方法 / 登录）
- Hero 区：`BlurText` 动画标题「认真地，听见你。」+ 副标题 + CTA + 实时计数小字
- 方法论区：长文段落 + 三点说明（不做预测 / 不做诊断 / 不做评判）
- 创始人寄语区：衬线斜体长引言
- 邮件订阅区：极简表单（前端模拟，未接后端）
- 表单区：嵌入 `EmotionForm`
- 定价区：单列 ¥198 / ¥498
- FAQ 区：原生 `<details>` 手风琴
- Footer：编辑感版式

**登录页 [app/auth/signin/page.tsx](../app/auth/signin/page.tsx)** — 邮箱输入 → `signIn("email")` → 发送后切换为「登录链接已发送」状态。

**对话页 [app/chat/[sessionId]/page.tsx](../app/chat/[sessionId]/page.tsx)** — 加载历史 → 发送消息 → 流式更新最后一条 AI 消息。当前使用 `tempUserId = "guest-user"`（待接入 NextAuth）。

### 10.2 动画组件

均位于 [components/animations/](../components/animations/)，源自 ReactBits.dev：

| 组件 | 实现 | 用途 |
|------|------|------|
| [BlurText.tsx](../components/animations/BlurText.tsx) | IntersectionObserver + 动态 `@keyframes` | 文字从模糊到清晰渐显，支持按词/字符 |
| [Aurora.tsx](../components/animations/Aurora.tsx) | Canvas + `requestAnimationFrame` | 多色径向渐变极光背景 |
| [CountUp.tsx](../components/animations/CountUp.tsx) | framer-motion `animate` | 数字递增动画 |
| [Magnet.tsx](../components/animations/Magnet.tsx) | `mousemove` 监听 | 按钮光标吸附效果 |
| [ParticleTrail.tsx](../components/animations/ParticleTrail.tsx) | Canvas + 贝塞尔曲线 | 三层（远/中/近）金色粒子轨迹，带鼠标吸引 |

### 10.3 设计系统

- 颜色（[tailwind.config.ts](../tailwind.config.ts)）：`paper`（暖米）/ `ink`（近黑）/ `accent`（暖橘 #D97706）/ `deep`（深蓝黑 #1A1F2E）
- 字体：`Fraunces`（衬线标题）/ `Inter`（正文）/ `JetBrains Mono`（小标签）
- 组件类（[app/globals.css](../app/globals.css)）：`.btn-editor`、`.input-editor`、`.pill-editor`、`.reading-content`、`.paper-texture`、`.typing-cursor` 等

---

## 11. 子项目与设计资源

### 11.1 `lithos/` 设计原型子项目

独立的 Vite + React 19 SPA，**不参与 Next.js 构建**，作为视觉与交互原型独立迭代。

- 技术栈：Vite 8、React 19、react-router-dom 7、framer-motion 12、lucide-react、Tailwind 3.4、oxlint
- 路由（[src/App.tsx](../lithos/src/App.tsx)）：
  - `/` → `Hero + About + Features`（首页三段）
  - `/signin` → 登录页
  - `/chat` → 对话页（含预设对话样例）
  - `/assessment` → 评估三步表单（含 `WordsPullUp` 动画）
  - `/profile` → 个人中心
- 运行：`cd lithos && npm install && npm run dev`
- 与主项目关系：lithos 用于探索更激进的视觉方案（黑色背景 + 视频 hero + 实时事件 ticker），主项目 `app/` 则采用更克制的「编辑设计」暖米色风格。

### 11.2 `wenxin-ai-design/` 与 `wenxin-ai-barbiecore/` 设计资源

两个设计生成工具产物目录，结构一致：

```
wenxin-ai-design/
├── pages/            # index.html / signin.html / chat.html
├── partials/         # project-shell.html（共享外壳）
├── colors_and_type.css
├── generation-tree.json      # 设计生成树
├── orchestration-summary.json # 编排摘要（含 visualNorthStar、compositionPattern）
└── wenxin-ai-design.design
```

- `wenxin-ai-design`：当前采用的「温暖编辑叙事」方向（paper texture、Fraunces、单列、细线分隔）。
- `wenxin-ai-barbiecore`：备用方向，额外含 `assessment.html` 与 `profile.html`。
- `orchestration-summary.json` 记录每个页面的 `visualNorthStar`、`compositionPattern`、`soulElement` 等设计意图，是前端实现的参考蓝本。

---

## 12. 依赖关系

### 12.1 主项目 `package.json`

**dependencies**
- `next` 14.2.15 — 全栈框架
- `react` / `react-dom` 18.3.1
- `@prisma/client` 6.19.3 — 数据库 ORM
- `prisma` 6.19.3 — CLI/引擎
- `@auth/prisma-adapter` 2.11.2 — NextAuth 与 Prisma 桥接
- `next-auth` 4.24.14 — 认证
- `resend` 6.16.0 — 邮件
- `openai` 4.67.0 — LLM SDK（兼容 MiniMax/DeepSeek 等）
- `@anthropic-ai/sdk` 0.30.1 — Anthropic 协议预留
- `framer-motion` 12.42.0 — 动画

**devDependencies**
- `typescript` 5.6.2、`@types/{node,react,react-dom,bcryptjs,jsonwebtoken}`
- `tailwindcss` 3.4.13、`postcss` 8.4.47、`autoprefixer` 10.4.20

### 12.2 内部模块依赖图

```
app/page.tsx ─────► components/EmotionForm ──► lib/prompts (UserFormData)
        │           components/ResultDisplay
        │           components/animations/BlurText
        │
        ├──► app/api/summary  ──► lib/llm ──► lib/prompts
        │                        │             (buildSummaryPrompt)
        │                        └──► openai / fetch (Anthropic)
        │
        └──► app/api/analyze   ──► lib/llm ──► lib/prompts
                                    │             (buildFullPrompt)
                                    └──► openai / fetch

app/chat/[sessionId] ──► components/ChatBubble
        │
        ├──► app/api/sessions/[id]         ──► lib/prisma
        └──► app/api/sessions/[id]/messages ──► lib/prisma
                                              └► lib/llm ──► lib/prompts
                                                  (buildChatPrompt)

app/auth/signin ──► next-auth/react ──► app/api/auth/* ──► lib/auth
                                                       └► lib/prisma
                                                       └► resend
```

### 12.3 运行时依赖

- `lib/prisma.ts` 不可在 Edge Runtime 使用 → 凡用到 `prisma` 的路由均声明 `runtime = "nodejs"`。
- `lib/llm.ts` 仅用 `openai` SDK 与原生 `fetch`，可在 Edge Runtime 运行。
- `lib/auth.ts` 同时使用 `PrismaAdapter`（需 Node）与 JWT（Edge 兼容），NextAuth 路由默认 Node。

---

## 13. 环境变量

模板见 [.env.local.example](../.env.local.example)：

```env
# LLM 配置（必填）
LLM_PROVIDER=minimax
LLM_API_KEY=请填写你的_API_Key
LLM_BASE_URL=https://api.minimaxi.com/v1
LLM_MODEL=MiniMax-M3

# 备选模型（注释掉，按需启用）
# DeepSeek / Kimi / GLM / Qwen 等 OpenAI 兼容 API

# 网站元数据（可选，前端可见）
NEXT_PUBLIC_SITE_NAME=问心 AI
NEXT_PUBLIC_WECHAT_ID=your_wechat_id_here
NEXT_PUBLIC_SITE_URL=https://your-domain.pages.dev
```

PROJECT.md 另记录的运行时变量（生产部署需要）：

```env
DATABASE_URL=postgresql://...neon.tech/neondb   # Neon PostgreSQL
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...                              # JWT 签名密钥
RESEND_API_KEY=re_...                            # Resend 邮件
RESEND_FROM_EMAIL=onboarding@resend.dev
```

> `lib/llm.ts` 兼容旧变量名 `MINIMAX_API_KEY` / `DEEPSEEK_API_KEY` 作为 `LLM_API_KEY` 的回退。

---

## 14. 项目运行方式

### 14.1 前置条件

- Node.js 18.x 或 20.x
- 一个 OpenAI 兼容的 LLM API Key（推荐 MiniMax-M3）
- （可选）Neon PostgreSQL 连接串、Resend API Key、NextAuth Secret

### 14.2 本地开发

```bash
# 1. 安装依赖
cd /Users/opc-1/ai-emotion-reader
npm install

# 2. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，至少填写 LLM_API_KEY

# 3. （如使用数据库/认证）生成 Prisma 客户端并同步 schema
npx prisma generate
npx prisma db push     # 或 npx prisma migrate dev

# 4. 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

### 14.3 生产构建

```bash
npm run build     # next build
npm run start     # next start（需先 build）
npm run lint      # next lint
```

### 14.4 子项目 lithos 本地运行

```bash
cd lithos
npm install
npm run dev       # Vite 开发服务器
npm run build     # tsc -b && vite build
npm run preview   # 预览构建产物
npm run lint      # oxlint
```

### 14.5 关键脚本（主项目 [package.json](../package.json)）

| 脚本 | 命令 | 说明 |
|------|------|------|
| `dev` | `next dev` | 开发服务器（默认 :3000） |
| `build` | `next build` | 生产构建到 `.next/` |
| `start` | `next start` | 启动生产服务器 |
| `lint` | `next lint` | ESLint 检查 |

---

## 15. 部署

### 15.1 EdgeOne Pages（推荐，详见 [DEPLOY.md](../DEPLOY.md)）

1. 代码推送至 GitHub（`StarlitSKy88/ai-emotion-reader`）。
2. EdgeOne Pages 控制台 → 新建项目 → 导入 Git 仓库。
3. 构建设置：
   - 框架预设：Next.js
   - 构建命令：`npm run build`
   - 输出目录：`.next`
   - 安装命令：`npm install`
   - Node 版本：18.x / 20.x
4. 环境变量（生产 + 预览两个环境均需）：
   - `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`
   - `DATABASE_URL`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET`
   - `RESEND_API_KEY`、`RESEND_FROM_EMAIL`
   - `NEXT_PUBLIC_SITE_NAME`、`NEXT_PUBLIC_WECHAT_ID`
5. 部署成功后获得 `*.pages.dev` 域名，后续 `git push` 自动部署。

### 15.2 部署后验证清单

- 首页正常加载（暖米纸纹 + 编辑风排版）
- 三步表单可填写并提交
- 提交后摘要流式显示
- 点击「解锁完整版」生成完整解读
- 微信引流卡片显示正确
- 移动端访问正常
- 登录邮件可送达（依赖 Resend 配置）

### 15.3 切换 LLM 模型

只需修改 `.env.local`（或 EdgeOne 环境变量）三行即可，无需改代码：

```env
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

若使用 MiniMax Token 订阅 Key（Anthropic 协议），将 `LLM_BASE_URL` 设为含 `/anthropic` 的地址，`lib/llm.ts` 会自动切换到 Anthropic 流式分支。

---

## 附录：相关文档

- [README.md](../README.md) — 面向用户的项目说明与商业模式
- [PROJECT.md](../PROJECT.md) — 内部开发文档与路线图
- [DEPLOY.md](../DEPLOY.md) — EdgeOne 部署详细步骤
- [docs/STRUCTURE.md](./STRUCTURE.md) — 结构与数据流图
- [docs/DESIGN_REFERENCES.md](./DESIGN_REFERENCES.md) — 设计参考库与组件清单
- [prisma/schema.prisma](../prisma/schema.prisma) — 数据库 Schema 原始定义
