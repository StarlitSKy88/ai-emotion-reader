# 问心 AI · 情侣关系成长产品 · 技术方案 v4.1

> 版本：v4.1 · 配对架构重构 + 男女题库分离 + 同性恋类型扩充
> 日期：2026-07-04
> 状态：用户已通过，待执行
> 配套文档：[TEST_QUESTIONS.md](./TEST_QUESTIONS.md) · [COUPLE_TYPES.md](./COUPLE_TYPES.md)
> v4.1 变更：同性恋类型从 8+8 扩充至 15+15（共 65 种）；开放题增加 3 个约束

---

## 目录

1. [核心架构变更（v4 关键更新）](#1-核心架构变更v4-关键更新)
2. [Harness 框架与复利工程](#2-harness-框架与复利工程)
3. [整体架构](#3-整体架构)
4. [数据库 Schema 设计](#4-数据库-schema-设计)
5. [配对机制 API 设计](#5-配对机制-api-设计)
6. [原子级功能点总览](#6-原子级功能点总览)
7. [Phase 0：基础设施](#7-phase-0基础设施)
8. [Phase 1：男女分离题库 + 测试答题](#8-phase-1男女分离题库--测试答题)
9. [Phase 2：双方配对机制（核心）](#9-phase-2双方配对机制核心)
10. [Phase 3：类型匹配 + 结果分享](#10-phase-3类型匹配--结果分享)
11. [Phase 4：每日任务](#11-phase-4每日任务)
12. [Phase 5：成长报告与付费](#12-phase-5成长报告与付费)
13. [Phase 6：Web 官网改造](#13-phase-6web-官网改造)
14. [并行审核 Agent 矩阵](#14-并行审核-agent-矩阵)
15. [关键决策记录](#15-关键决策记录)
16. [风险与对策](#16-风险与对策)

---

## 1. 核心架构变更（v4 关键更新）

### 1.1 三大架构变更

| 变更点 | v3 方案 | v4 方案 | 变更理由 |
|--------|---------|---------|---------|
| **题库** | 男女共用 20 题 | 男女各 30 题独立 | 男女在恋爱中角色不同，一套题失真 |
| **配对机制** | A 答完即出类型 | 必须双方都答题才出类型 | 类型是「双方关系」不是「单人画像」 |
| **结果查看** | 双方都能直接看 | A 必须等 B 主动分享结果卡片 | 强制双边参与 + 避免多人混淆 |

### 1.2 配对机制核心流程

```
A 答完 30 题（男版或女版）
   ↓
A 看到全屏「邀请伴侣解锁」（完全无结果）
   ↓
A 点击「邀请 TA 测」→ 生成测试邀请链接（不含结果）
   ↓
A 分享到微信对话/朋友圈
   ↓
B/C/D 扫码进入小程序
   ↓
选择路径：
┌─ 路径 1：「我是 A 的伴侣」
│  ↓
│  B 答完 30 题（按 B 的性别分配题库）
│  ↓
│  系统合并 A+B 答案 → 按性别组合触发类型库
│  - 男+女 → 异性恋类型库（30 常见 + 5 稀有）
│  - 男+男 → 男男专属类型库（15 种）
│  - 女+女 → 女女专属类型库（15 种）
│  ↓
│  B 能看到 A+B 完整结果（含双方头像昵称）
│  ↓
│  B 点击「分享结果给 TA」→ 生成结果卡片
│  ↓
│  A 点卡片 → 进入小程序 → 查看 A+B 结果
│
└─ 路径 2：「我不是 A 的伴侣」
   ↓
   B 答完 30 题 → B 成为新发起人 → B 邀请自己的伴侣
```

### 1.3 A 的首页状态设计

A 答完题后打开小程序：
- **不显示任何结果**
- 显示「邀请伴侣解锁」全屏引导页
- 底部小字：「已邀请 N 人 / X 人已完成」
- 点击已完成的人 → 显示「等 TA 分享结果给你」（不显示结果）

### 1.4 分享测试 vs 分享结果

| 分享类型 | 入口 | 卡片内容 | 跳转目标 |
|---------|------|---------|---------|
| 分享测试 | A 首页「邀请 TA 测」 | 「我测了我们的情侣类型，来测测你的」 | 测试开始页 |
| 分享结果 | B 结果页「分享给 TA」 | 双方头像 + 类型 + 雷达图 | 结果查看页 |

---

## 2. Harness 框架与复利工程

### 2.1 四步循环

```
① 计划（Plan）→ ② 执行（Execute）→ ③ 审查（Review）→ ④ 固化（Compound）
```

- **80% 时间用于规划和审查**
- **20% 时间用于编码**
- 每个原子点遵循三重循环
- 修完 bug 就固化解法到 CLAUDE.md

### 2.2 CLAUDE.md 知识库结构

```
ai-emotion-reader/
├── CLAUDE.md                    # 主知识库
├── .claude/
│   ├── patterns/                # 已验证的代码模式
│   ├── pitfalls/                # 已踩过的坑
│   ├── decisions/               # 关键决策记录
│   └── review-templates/        # 审查模板
```

### 2.3 原子点完成定义

- [ ] 代码可运行，无 TypeScript 错误
- [ ] 14 个审查 Agent 全部 GO
- [ ] 验证场景跑通
- [ ] 新增/修改的坑已写入 CLAUDE.md
- [ ] 不破坏已有原子点（回归验证）

---

## 3. 整体架构

```
┌──────────────────────────────────────────────────┐
│              微信小程序（核心产品）                │
│   Taro 4 + React 18                              │
│   测试 / 配对 / 类型结果 / 每日任务 / 成长报告    │
│   微信登录 + 订阅消息推送 + 流量主广告            │
└──────────────────┬───────────────────────────────┘
                   │ HTTPS / WebSocket
                   ▼
┌──────────────────────────────────────────────────┐
│         Next.js 14 后端（现有仓库复用）           │
│   App Router API Routes (Node Runtime)           │
│   /api/auth /api/test /api/couple /api/pair      │
│   /api/couple-type /api/task /api/report         │
└──────┬─────────────────────┬─────────────────────┘
       │                     │
       ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│ Neon Postgres│    │  LLM (OpenAI 兼容)│
│ Prisma ORM   │    │  lib/llm.ts 复用  │
└──────────────┘    └──────────────────┘

┌──────────────────────────────────────────────────┐
│         Next.js Web 官网（品牌落地页）            │
│   现有 app/ 改造为营销页 + 小程序码引导           │
│   部署在 EdgeOne Pages                            │
└──────────────────────────────────────────────────┘
```

### 技术栈选型

| 层 | 选型 | 理由 |
|----|------|------|
| 小程序前端 | Taro 4 + React 18 | 复用现有 React 组件逻辑 |
| 后端 | 保留 Next.js 14 App Router | [app/api/](../app/api) 全部复用 |
| 数据库 | 保留 Neon Postgres + Prisma 6 | 扩展新表 |
| LLM | 保留 lib/llm.ts | OpenAI 兼容，一行配置切模型 |
| 认证 | 微信登录 + JWT | 替换 NextAuth 邮箱登录 |
| 支付 | 微信支付 + 虚拟支付 | iOS 虚拟商品走微信虚拟支付 |
| 广告 | 微信流量主 | 激励视频解锁测试结果 |

---

## 4. 数据库 Schema 设计

在 [prisma/schema.prisma](../prisma/schema.prisma) 现有基础上追加。

### 4.1 User 表扩展

```prisma
model User {
  // ... 现有字段保留 ...
  openid        String?  @unique  // 微信小程序 openid
  unionid       String?           // 微信 unionid
  phone         String?           // 手机号
  avatarUrl     String?           // 微信头像
  nickname      String?           // 微信昵称
  gender        String?           // male / female / other
  // ... 现有关联保留 ...
  testSessions  TestSession[]     // 用户作为发起人的测试
  pairSessions  PairSession[]     // 用户作为参与者的配对
  taskResponses TaskResponse[]
}
```

### 4.2 测试会话（替代 v3 的 TestResult）

```prisma
model TestSession {
  id              String   @id @default(cuid())
  userId          String   // 发起人 A
  // 30 题答案
  answers         Json     @default("{}")  // {q1: "A", q2: "B", ...}
  // 开放题随机抽中的题目 ID
  openQuestionId  String?  // 1-10
  openAnswer      String?  @db.Text  // 开放题答案
  // 6 维度分数（A 个人）
  dimensions      Json     @default("{}")
  // 性别（决定题库版本）
  gender          String   // male / female
  // 时间
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  pairSessions    PairSession[]

  @@index([userId])
  @@map("test_sessions")
}
```

### 4.3 配对会话（核心：A+B 配对关系）

```prisma
model PairSession {
  id              String   @id @default(cuid())
  // 双方测试会话
  initiatorId     String   // A 的 TestSession ID
  responderId     String   // B 的 TestSession ID
  // 双方用户
  initiatorUserId String   // A 的 User ID
  responderUserId String   // B 的 User ID
  // 配对状态
  status          String   @default("pending")  // pending / completed / expired
  // 性别组合（决定类型库）
  genderCombo     String   // male-female / male-male / female-female
  // 合并后的 6 维度分数
  dimensionsA     Json     @default("{}")  // A 的维度分
  dimensionsB     Json     @default("{}")  // B 的维度分
  compatibility   Int?     // 默契度 0-100
  // 类型匹配结果
  matchedTypeId   String?  // 关联到 CoupleType
  matchedTypeCode String?  // 冗余字段，便于快速查询
  alternatives    Json     @default("[]")  // 备选类型 2 个
  // AI 解读
  summary         String?  @db.Text
  // 解锁状态
  unlocked        Boolean  @default(false)
  unlockMethod    String?  // pay / ad
  // 结果分享状态
  resultSharedToInitiator Boolean @default(false)  // B 是否已分享给 A
  // 时间
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  initiator       TestSession @relation("initiator", fields: [initiatorId], references: [id], onDelete: Cascade)
  responder       TestSession @relation("responder", fields: [responderId], references: [id], onDelete: Cascade)
  initiatorUser   User        @relation("initiatorUser", fields: [initiatorUserId], references: [id])
  responderUser   User        @relation("responderUser", fields: [responderUserId], references: [id])
  coupleType      CoupleType? @relation(fields: [matchedTypeId], references: [id])

  @@index([initiatorUserId])
  @@index([responderUserId])
  @@index([status])
  @@map("pair_sessions")
}
```

### 4.4 情侣类型库

```prisma
model CoupleType {
  id              String   @id @default(cuid())
  code            String   @unique  // OLD_COUPLE / KITE_LINE / ...
  name            String              // 「烟火余生型」
  emoji           String              // 🎆
  rarity          String   @default("common")  // common / rare
  genderCombo     String   @default("male-female")  // male-female / male-male / female-female
  estimatedRatio  Float               // 0.18 = 18%
  oneLiner        String              // 一句话
  description     String   @db.Text   // 详细解读
  hiddenRisks     String   @db.Text   // 隐藏短板
  growthAdvice    String   @db.Text   // 成长建议
  shareCopy       String              // 朋友圈分享文案
  radarProfile    Json                // 雷达图特征
  attachmentCombo String              // "S×S" / "A×D" / ...
  conflictPattern String              // "repair" / "pursue-pursue" / ...
  stage           String              // "stable" / "honeymoon" / ...
  marketingAngle  String?             // 营销定位（稀有类型用）
  isPublic        Boolean  @default(true)  // 是否在公共类型百科展示（同性专属=false）
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  pairSessions    PairSession[]
  couples         Couple[]

  @@map("couple_types")
}
```

### 4.5 Couple 关系表（配对成功后创建）

```prisma
model Couple {
  id            String   @id @default(cuid())
  pairSessionId String   @unique  // 关联到配对会话
  partnerAId    String
  partnerBId    String
  relationshipStart DateTime?
  stage         String   @default("dating")
  status        String   @default("active")
  profile       Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  pairSession   PairSession @relation(fields: [pairSessionId], references: [id], onDelete: Cascade)
  partnerA      User     @relation("coupleA", fields: [partnerAId], references: [id])
  partnerB      User     @relation("coupleB", fields: [partnerBId], references: [id])
  dailyTasks    DailyTask[]

  @@index([partnerAId])
  @@index([partnerBId])
  @@map("couples")
}
```

### 4.6 每日任务 + 回应（同 v3，略）

```prisma
model DailyTask {
  id           String   @id @default(cuid())
  coupleId     String
  date         DateTime
  title        String
  description  String   @db.Text
  difficulty   String   @default("medium")
  sourceDimension String
  targetDimension String?
  estimatedMin Int      @default(3)
  statusA      String   @default("pending")
  statusB      String   @default("pending")
  createdAt    DateTime @default(now())

  couple       Couple   @relation(fields: [coupleId], references: [id], onDelete: Cascade)
  responses    TaskResponse[]

  @@unique([coupleId, date])
  @@map("daily_tasks")
}

model TaskResponse {
  id           String   @id @default(cuid())
  taskId       String
  userId       String
  content      String   @db.Text
  emotionTag   String?
  perspective  String?  @db.Text
  mediaUrls    Json     @default("[]")
  createdAt    DateTime @default(now())

  task         DailyTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@map("task_responses")
}
```

---

## 5. 配对机制 API 设计

### 5.1 测试 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/test/start` | POST | 传 gender → 返回对应题库 30 题 + 随机开放题 |
| `/api/test/submit` | POST | 传 userId + answers + openAnswer → 创建 TestSession |
| `/api/test/session/[id]` | GET | 获取测试会话状态 |

### 5.2 配对 API（核心）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/pair/init/[testSessionId]` | GET | A 获取邀请链接/卡片（不含结果） |
| `/api/pair/join/[testSessionId]` | POST | B 扫码加入，选择路径（伴侣/非伴侣） |
| `/api/pair/complete` | POST | B 提交答案 → 合并 A+B → 生成 PairSession + 类型匹配 |
| `/api/pair/[pairSessionId]/result` | GET | 获取配对结果（需 unlock） |
| `/api/pair/[pairSessionId]/unlock` | POST | 传 unlockMethod(pay/ad) → unlocked=true |
| `/api/pair/[pairSessionId]/share` | POST | B 分享结果给 A → resultSharedToInitiator=true |
| `/api/pair/initiator-status` | GET | A 查看自己的「已邀请 N 人 / X 人已完成」状态 |

### 5.3 类型 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/couple-type/list` | GET | 返回所有公开类型（isPublic=true） |
| `/api/couple-type/[code]` | GET | 获取单个类型详情 |
| `/api/couple-type/match` | POST | 传双方 TestSession → 返回匹配类型 + 备选 |

### 5.4 任务 API（同 v3，略）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/task/today` | GET | 获取今日任务 |
| `/api/task/[taskId]` | GET | 任务详情 |
| `/api/task/[taskId]/response` | POST | 提交回应 |
| `/api/task/[taskId]/summary` | GET | 默契度总结 |

### 5.5 报告 API（同 v3，略）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/report/[coupleId]?range=7\|30` | GET | 成长报告 |

---

## 6. 原子级功能点总览

| Phase | 主题 | 原子点数 | 验证目标 |
|-------|------|---------|---------|
| Phase 0 | 基础设施 | 17 | 真机登录成功 |
| Phase 1 | 男女分离题库 + 答题 | 18 | 30 题 5 分钟答完 |
| Phase 2 | 双方配对机制（核心） | 22 | 邀请转化 >50% |
| Phase 3 | 类型匹配 + 结果分享 | 19 | 分享率 >15% |
| Phase 4 | 每日任务 | 20 | 任务完成率 >40% |
| Phase 5 | 成长报告与付费 | 16 | 订阅转化 >8% |
| Phase 6 | Web 官网 | 8 | 扫码转化 >20% |
| **总计** | | **120** | |

---

## 7. Phase 0：基础设施

### 0.1 数据库扩展（6 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 0.1.1 | User 表扩展（openid/unionid/phone/avatarUrl/nickname/gender） | migrate 成功，旧数据无丢失 |
| 0.1.2 | TestSession 模型迁移 | 能插入测试会话记录 |
| 0.1.3 | PairSession 模型迁移 | 能插入配对会话记录 |
| 0.1.4 | CoupleType 模型迁移 | 能插入类型记录 |
| 0.1.5 | Couple + DailyTask + TaskResponse 模型迁移 | 全部 migrate 成功 |
| 0.1.6 | 65 种 CoupleType seed 数据 | 查询返回 65 条（含同性专属 isPublic=false） |

### 0.2 微信登录（3 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 0.2.1 | lib/wechat-auth.ts 工具函数 | code → openid |
| 0.2.2 | /api/auth/wechat 路由 | 返回 JWT |
| 0.2.3 | /api/auth/phone 路由 | 绑定手机号 |

### 0.3 Taro 小程序脚手架（5 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 0.3.1 | miniapp/ Taro 4 初始化 | 能编译预览 |
| 0.3.2 | app.config.ts 页面路由 | 能打开每个页面 |
| 0.3.3 | services/api.ts 封装 HTTPS 请求 | 能调通后端 |
| 0.3.4 | store/user.ts 状态管理 | 登录后 store 更新 |
| 0.3.5 | pages/login/ 微信授权登录页 | 真机能完成登录 |

### 0.4 共享类型（3 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 0.4.1 | shared/types.ts 核心类型 | 前后端 import 无错误 |
| 0.4.2 | shared/test-bank-male.ts 男生 30 题 | 题目字段完整 |
| 0.4.3 | shared/test-bank-female.ts 女生 30 题 | 题目字段完整 |

**Phase 0 验证门槛**：真机登录成功，数据库新表就绪，题库数据就绪。

---

## 8. Phase 1：男女分离题库 + 测试答题

### 1.0 6 维度定义（与 TEST_QUESTIONS.md 对齐）

| 代号 | 维度 | 心理学依据 | 满分题数 |
|------|------|-----------|---------|
| D1 | 依恋安全性 | ECR-R 成人依恋量表 | 5 题（含 Q5 无厘头）|
| D2 | 沟通质量 | Gottman 沟通模式 | 5 题（含 Q10 无厘头）|
| D3 | 冲突修复 | Gottman 修复尝试 | 5 题（含 Q15 无厘头）|
| D4 | 共同意义 | Gottman 共同意义 | 4 题 |
| D5 | 信任承诺 | Gottman 信任/承诺 | 5 题（含 Q24 无厘头）|
| D6 | 亲密激情 | Sternberg 爱情三角 | 5 题 |

> 合计 29 题 + 1 开放题 = 30 题。

### 1.1 题库与计分（5 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 1.1.1 | 男生 30 题 seed（含 6 维度 + 无厘头 + 开放题） | 题目字段完整 |
| 1.1.2 | 女生 30 题 seed | 题目字段完整 |
| 1.1.3 | 6 维度计分函数 | 全 A 答案 → D1 高分 |
| 1.1.4 | 默契度算法（双方对比） | 完全相同 → 100；完全不同 → 0 |
| 1.1.5 | 开放题随机抽取（同 couple 同题 + 3 维度统一 + 30 天内复用同题） | 同一 PairSession 双方拿到同题；3 维度统一；30 天内重测复用同题 |

### 1.2 测试 API（4 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 1.2.1 | /api/test/start 路由（按性别返回题库） | 男→男版，女→女版 |
| 1.2.2 | /api/test/submit 路由 | 创建 TestSession，算分 |
| 1.2.3 | /api/test/session/[id] 路由 | 返回测试状态 |
| 1.2.4 | 开放题 LLM 分析函数 | 输出情感关键词 + 依恋信号 |

### 1.3 小程序答题页（6 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 1.3.1 | pages/test/intro/ 介绍页 | 点击开始 → 跳转 questions |
| 1.3.2 | pages/test/questions/ 答题页 UI | 30 题 5 分钟答完 |
| 1.3.3 | 答题进度本地存储 | 退出后能从断点继续 |
| 1.3.4 | 开放题文本输入页 | 能输入 200 字 |
| 1.3.5 | pages/test/submit/ 提交页 | 提交后跳转「邀请伴侣」 |
| 1.3.6 | 雷达图组件（6 维度） | 双方分数不同时能区分 |

### 1.4 性别选择与代词适配（3 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 1.4.1 | 注册时性别选择页 | 男/女/其他 |
| 1.4.2 | 题干代词动态替换 | 异性恋用「他/她」，同性恋用「TA」 |
| 1.4.3 | 性别组合判断函数 | 返回 male-female / male-male / female-female |

**Phase 1 验证目标**：30 题 5 分钟答完，按性别分配正确题库，代词正确替换。

---

## 9. Phase 2：双方配对机制（核心）

### 2.1 配对 API（8 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 2.1.1 | /api/pair/init/[testSessionId] 路由 | A 获取邀请链接（不含结果） |
| 2.1.2 | /api/pair/join/[testSessionId] 路由 | B 扫码加入，选择路径 |
| 2.1.3 | 路径 1 处理：B 是 A 伴侣 | B 答题 → 创建 PairSession |
| 2.1.4 | 路径 2 处理：B 非 A 伴侣 | B 成为新发起人 |
| 2.1.5 | /api/pair/complete 路由 | B 提交 → 合并 → 算分 → 匹配类型 |
| 2.1.6 | /api/pair/[pairSessionId]/result 路由 | 返回结果（需 unlock） |
| 2.1.7 | /api/pair/[pairSessionId]/share 路由 | B 分享给 A → resultSharedToInitiator=true |
| 2.1.8 | /api/pair/initiator-status 路由 | A 查看邀请状态 |

### 2.2 A 的首页状态（3 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 2.2.1 | pages/index/ 邀请引导页 | 全屏「邀请伴侣解锁」 |
| 2.2.2 | 「已邀请 N 人 / X 人已完成」状态显示 | 实时更新 |
| 2.2.3 | 点击已完成 → 显示「等 TA 分享结果给你」 | 不显示结果 |

### 2.3 邀请分享（3 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 2.3.1 | 分享测试卡片生成 | 微信对话显示卡片 |
| 2.3.2 | 邀请链接含 testSessionId | 扫码能进入小程序 |
| 2.3.3 | B 扫码后路径选择页 | 两个选项清晰 |

### 2.4 解锁支付/广告（4 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 2.4.1 | /api/pair/[pairSessionId]/unlock 路由 | 传 unlockMethod → unlocked=true |
| 2.4.2 | 微信支付订单创建 | 返回 prepay_id |
| 2.4.3 | 微信支付回调 | 模拟回调 → unlocked 更新 |
| 2.4.4 | 流量主激励视频接入 | 真机看广告 → 触发解锁 |

### 2.5 边缘情况处理（6 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 2.5.1 | A 邀请多人，多人完成 | A 收到多个结果卡片，每个独立 |
| 2.5.2 | B 完成但 A 没收到分享 | A 看不到结果，只看到「X 已完成」 |
| 2.5.3 | 30 天内重复测 | 提示「已测过」 |
| 2.5.4 | 双方答案严重矛盾 | 提示重测 |
| 2.5.5 | 双方性别相同 | 触发同性专属类型库（男男 15 / 女女 15），不在公共百科展示 |
| 2.5.6 | A 想重新测 | 30 天后解锁重测入口，重测后复用上次开放题 ID（约束 3） |

**Phase 2 验证目标**：邀请转化率 >50%、解锁率 >30%、配对流程顺畅。

---

## 10. Phase 3：类型匹配 + 结果分享

### 3.1 类型匹配算法（6 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 3.1.1 | 依恋风格分类函数 | D1≥75→S; <50→D |
| 3.1.2 | 冲突模式分类函数 | 全追答案 → pursue-pursue |
| 3.1.3 | 关系阶段判断函数 | D6 高 + 阶段 < 6 个月 → honeymoon |
| 3.1.4 | 三元组精确匹配 | (S,S,stable) → 烟火余生型 |
| 3.1.5 | 性别组合触发类型库 | male-male → 男男专属 15 种；female-female → 女女专属 15 种 |
| 3.1.6 | 无精确匹配时相似度回退 | 返回 top 3 备选 |

### 3.2 结果展示（4 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 3.2.1 | pages/pair/result/ 结果页 | 显示类型 + 雷达图 + 双方头像 |
| 3.2.2 | 类型详情页 | 完整展示解读/短板/建议 |
| 3.2.3 | 类型百科页（仅公开类型） | 65 种中 isPublic=true 的 35 种 |
| 3.2.4 | 雷达图叠加双方分数 | 6 维度 + 双方不同颜色 |

### 3.3 结果分享（5 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 3.3.1 | B 主动分享结果卡片给 A | 含双方头像 + 类型 + 雷达图 |
| 3.3.2 | A 点卡片查看结果 | 跳转到结果查看页 |
| 3.3.3 | 朋友圈图片分享 | Canvas 绘制 + 保存相册 |
| 3.3.4 | 4 种卡片变体（炫耀/自嘲/求助/神秘） | 按 rarity 自动选模板 |
| 3.3.5 | 分享来源追踪 | utm 参数记录 |

### 3.4 同性恋专属类型触发（4 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 3.4.1 | male-male 触发男男 15 种类型 | 不在公共百科展示 |
| 3.4.2 | female-female 触发女女 15 种类型 | 不在公共百科展示 |
| 3.4.3 | 同性专属类型卡片设计 | 含专属命名 + emoji |
| 3.4.4 | 同性类型隐私保护 | 不出现在分享卡片传播中 |

**Phase 3 验证目标**：分享率 >15%、扫码转化 >20%、65 种类型分布合理。

---

## 11. Phase 4：每日任务

### 4.1 任务生成引擎（5 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 4.1.1 | lib/task-generator.ts 7 维权重框架 | 给定输入输出最优维度 |
| 4.1.2 | 维度 2 短板定向生成 | D2 低 → 沟通类任务 |
| 4.1.3 | 维度 5 近期情绪模式识别 | 连续负面 → 情绪处理任务 |
| 4.1.4 | 维度 6 不对称检测 | 一方未完成 → 降难度 |
| 4.1.5 | fallback 预设任务库 | LLM 失败时兜底 |

### 4.2 任务 Prompt（3 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 4.2.1 | buildTaskGenerationPrompt | 输出含 title/difficulty/targetDimension |
| 4.2.2 | buildEmotionNamingPrompt | 不评判、只接住和命名 |
| 4.2.3 | buildTaskSummaryPrompt | 双方都完成后生成默契度 |

### 4.3 任务 API（4 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 4.3.1 | /api/task/today 路由 | 每天每对情侣只生成 1 个 |
| 4.3.2 | /api/task/[taskId] 路由 | 返回任务详情 + 双方回应 |
| 4.3.3 | /api/task/[taskId]/response 路由 | 提交回应 → AI 命名情绪 |
| 4.3.4 | /api/task/[taskId]/summary 路由 | 双方完成后返回默契度 |

### 4.4 小程序任务页（5 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 4.4.1 | pages/index/ 首页任务卡片 | 状态实时更新 |
| 4.4.2 | pages/task/detail/ 任务详情 | 点击开始 → chat 页 |
| 4.4.3 | pages/task/chat/ 对话页 UI | 双方能各自提交 |
| 4.4.4 | 拍照上传功能 | 最多 3 张照片 |
| 4.4.5 | AI 总结横幅 | 双方完成后显示默契度 |

### 4.5 订阅消息推送（3 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 4.5.1 | 微信后台订阅消息模板 | 模板审核通过 |
| 4.5.2 | /api/push/subscribe 路由 | DB 有订阅记录 |
| 4.5.3 | /api/push/cron 定时触发 | 真机能收到推送 |

**Phase 4 验证目标**：任务完成率 >40%、次日留存 >50%、AI 总结好评率 >70%。

---

## 12. Phase 5：成长报告与付费

### 5.1 报告聚合（4 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 5.1.1 | lib/report.ts 7 天数据聚合 | 返回任务完成率 + 情绪曲线 |
| 5.1.2 | 30 天数据聚合 | 大数据量 <2s |
| 5.1.3 | 6 维度变化计算 | D2 60→75 → 显示「+15%」 |
| 5.1.4 | 报告 Prompt | 含「你们这周的变化」叙事 |

### 5.2 报告 API（3 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 5.2.1 | /api/report/[coupleId] 路由 | 免费/付费分层返回 |
| 5.2.2 | 报告付费墙 | 未订阅 → 订阅 CTA |
| 5.2.3 | 报告分享 | 分享卡片 |

### 5.3 订阅系统（5 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 5.3.1 | 订阅产品配置（¥39/月、¥298/年） | 微信支付后台配置 |
| 5.3.2 | /api/subscription/create 路由 | 返回 prepay_id |
| 5.3.3 | /api/subscription/notify 回调 | DB 更新订阅状态 |
| 5.3.4 | 订阅状态校验中间件 | 过期 → 403 |
| 5.3.5 | 订阅管理页 | 查看套餐 + 续费/取消 |

### 5.4 危机用户保护（4 个原子点）

| # | 任务 | 验证场景 |
|---|------|---------|
| 5.4.1 | 关键词检测 | 含「不想活」→ 触发危机流程 |
| 5.4.2 | 危机话术 Prompt 边界 | 危机输入 → 心理热线引导 |
| 5.4.3 | 危机资源页 | 显示心理热线 |
| 5.4.4 | 危机转介自动化 | 自动跳转到资源页 |

**Phase 5 验证目标**：订阅转化 >8%、月留存 >50%、报告分享率 >15%。

---

## 13. Phase 6：Web 官网改造

| # | 任务 | 验证场景 |
|---|------|---------|
| 6.1 | app/page.tsx 改造为落地页 | 移动端体验好 |
| 6.2 | 小程序码生成 | 扫码进小程序 |
| 6.3 | SEO 优化 | Google 收录 |
| 6.4 | 部署到 EdgeOne Pages | 官网可访问 |
| 6.5 | 旧路由归档 | 301 重定向 |
| 6.6 | 小程序埋点 SDK | 关键事件有埋点 |
| 6.7 | 转化漏斗看板 | 每步转化率可见 |
| 6.8 | 留存曲线看板 | 留存趋势可见 |

**Phase 6 验证目标**：官网可访问、扫码转化 >20%、关键指标可追踪。

---

## 14. 并行审核 Agent 矩阵

每个原子点完成执行后，触发 14 个并行 Agent 审查：

| # | Agent | 审查维度 | GO/NO-GO 标准 |
|---|-------|---------|--------------|
| 1 | security-agent | 安全漏洞 | 无 SQL 注入、XSS、敏感信息泄漏 |
| 2 | performance-agent | 性能 | API 响应 <500ms、无 N+1 查询 |
| 3 | architecture-agent | 架构一致性 | 符合项目分层、无循环依赖 |
| 4 | typescript-agent | 类型安全 | 无 any、无 implicit any |
| 5 | api-contract-agent | API 契约 | 请求/响应 schema 完整 |
| 6 | db-agent | 数据库 | 索引合理、迁移可回滚 |
| 7 | ux-agent | 用户体验 | 加载态、错误态、空态都有处理 |
| 8 | edge-case-agent | 边界情况 | 列出 5 个边缘情况并处理 |
| 9 | prompt-quality-agent | Prompt 质量 | 输出不空洞、不套路化 |
| 10 | wechat-compliance-agent | 微信合规 | 不违反小程序审核规则 |
| 11 | psychology-agent | 心理学准确性 | 维度/类型/解读符合理论 |
| 12 | shareability-agent | 分享性 | 卡片有传播钩子 |
| 13 | regression-agent | 回归测试 | 不破坏已完成原子点 |
| 14 | doc-agent | 文档完整性 | CLAUDE.md 更新 |

---

## 15. 关键决策记录

| 决策 | 选择 | 理由 | 拒绝方案 |
|------|------|------|---------|
| 题库 | 男女各 30 题独立 | 男女角色不同，一套题失真 | 共用一套 |
| 配对机制 | 必须双方都答题 | 类型是双方关系不是单人画像 | A 答完即出类型 |
| 结果查看 | A 必须等 B 分享 | 强制双边参与 + 避免多人混淆 | 双方都能直接看 |
| 同性恋类型 | 男男 15 + 女女 15 专属 | 不同性别的关系模式不同，扩充以覆盖更多模式 | 共用一套类型 |
| 命名风格 | 三段式意象化（去角色标签） | 用自然意象表达关系动态，避免家庭角色标签 | MBTI 字母 / 父与子等角色标签 |
| 开放题 | 每对 couple 随机抽 1 + 3 约束 | 同 couple 同题 + 3 维度统一 + 30 天内复用同题 | 固定题目 / 完全随机 |
| 流式输出 | MVP 一次性返回 | 3 天上线 | WebSocket（V2 再做） |
| 认证 | 微信登录 + JWT | 小程序原生体验 | NextAuth 邮箱 |
| 项目结构 | 现有仓库 + miniapp/ | 最小侵入 | monorepo |

---

## 16. 风险与对策

| 风险 | 等级 | 对策 |
|------|------|------|
| 邀请转化率低 | 🔴 高 | 单人冷启动 + 卡片 A/B + 首次任务低门槛 |
| A 等不到 B 分享而流失 | 🔴 高 | A 首页显示「X 已完成」状态 + 推送提醒 B 分享 |
| 任务同质化 | 🔴 高 | 7 维生成 + 3 档难度 + 每周热点 |
| 微信虚拟支付审核 | 🟡 中 | 虚拟走微信虚拟支付；订阅走微信支付 |
| LLM 生成质量不稳定 | 🟡 中 | Prompt 强约束 + fallback 预设库 |
| 双方活跃度不对称 | 🟡 中 | 维度 6 不对称检测降难度 |
| 危机用户 | 🔴 高 | 关键词检测 + 心理热线引导 + Prompt 边界 |
| DB 迁移影响现有数据 | 🟡 中 | 只新增表 + 可选字段 + migrate 前备份 |
| 同性恋类型审核风险 | 🟡 中 | isPublic=false + 不出现在分享传播 |
| 65 类型分布不均 | 🟡 中 | 上线后监控分布，调整匹配算法阈值 |

---

## 附录：复用率估算

| 模块 | 复用率 | 说明 |
|------|--------|------|
| 后端 API 框架 | 90% | Next.js App Router 不动 |
| Prisma + DB | 60% | 新增 6 张表 |
| LLM 调用 | 100% | lib/llm.ts 不动 |
| Prompt 工程 | 20% | 全新 prompt |
| 认证 | 30% | 新写微信登录 |
| 前端组件 | 15% | 小程序重写 |
| 部署 | 100% | EdgeOne Pages 不动 |

**综合复用率 60%，新增 120 个原子点。**
