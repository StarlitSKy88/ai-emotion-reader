# 问心 AI · 情侣关系成长工具

> 基于心理学模型的情侣关系成长工具。每日 3 分钟任务 + 6 维度关系类型 + 7/30 天成长报告。

问心 AI 不是单次情感解读工具，而是一个面向情侣的长期关系成长系统：通过 6 维度匹配测试定位双方的关系类型，再用每日微行动和周期性成长报告推动关系持续成长。涵盖测试、配对、任务、报告、订阅、危机保护、官网与埋点看板等 Phase 0-6 共 120 个原子点。

---

## 核心功能

### 1. 情侣匹配测试
- 男女各 30 题，覆盖 6 大维度：依恋、沟通、冲突修复、共同意义、信任承诺、亲密激情
- 基于 6 维度得分组合出 65 种关系类型（CoupleType）
- 含开放题，由 LLM 进行叙事分析
- 测试题库与评分逻辑跨端共享，Web 与小程序结果一致

### 2. 双方配对机制
- A 用户发起邀请，生成邀请码 / 邀请链接
- B 用户加入后双方各自完成测试
- 仅当双方均提交后才生成统一的关系类型结果
- 结果支持分享卡片与小程序码回流

### 3. 每日任务
- 基于 7 维权重动态生成（依恋 / 沟通 / 冲突 / 意义 / 信任 / 亲密 + 默契度）
- 每日 3 分钟微行动，双方各自回应
- AI 生成默契度总结，标注分歧与共识
- 支持微信订阅消息推送提醒

### 4. 成长报告
- 7 天报告（免费层可见摘要）
- 30 天报告（付费层解锁完整叙事）
- 采用 LLM 叙事缓存，避免重复请求与超长上下文
- 报告包含趋势曲线、关键事件、下一阶段建议

### 5. 订阅系统
- 月度订阅：¥39 / 月
- 年度订阅：¥298 / 年（省 ¥170）
- 一次性购买，到期后需手动续费，不会自动扣款
- 基于微信支付 V3，订阅状态写入数据库并由 JWT 校验

### 6. 危机用户保护
- 三档检测：低风险提示、中风险引导自助资源、高风险直接给出心理热线
- 在测试、任务、报告多个触点嵌入检测
- 高危机情况下阻断继续引导付费，强制转向专业求助

### 7. Web 官网
- 落地页：产品介绍 + 功能展示 + 小程序码
- SEO 三件套：sitemap.ts / robots.ts / JSON-LD 结构化数据
- 旧路由 301 归档（在 next.config.js 配置），避免外链失效
- Admin 数据看板（鉴权访问）

### 8. 埋点看板
- 转化漏斗：访问 → 测试 → 配对 → 订阅
- 留存曲线：次日 / 7 日 / 30 日留存
- Admin 鉴权 + 数据脱敏，仅内部团队可见

---

## 技术栈

- **Next.js 14 App Router**：Web 官网 + API 后端同站部署
- **Taro 4**：微信小程序前端，独立打包，复用 shared 层
- **Prisma 6 + Neon Postgres**：Serverless Postgres，schema 即文档
- **MiniMax-M3**：默认 LLM，通过 OpenAI 兼容协议接入，可切换 DeepSeek / Kimi / GLM / Qwen
- **微信小程序登录 + JWT**：客户端拿 code，服务端换 openid 并签发 JWT
- **微信支付 V3**：订阅服务下单、回调、续费状态同步

---

## 项目结构

```
ai-emotion-reader/
├── app/                    # Next.js App Router
│   ├── page.tsx            # 官网落地页（Phase 6.1）
│   ├── layout.tsx          # 根 layout + SEO metadata + JSON-LD
│   ├── sitemap.ts          # SEO sitemap
│   ├── robots.ts           # SEO robots
│   ├── admin/dashboard/    # Admin 数据看板（Phase 6.7/6.8）
│   └── api/                # API 路由
│       ├── auth/           # 微信登录 + JWT
│       ├── test/           # 测试题库 + 提交
│       ├── pair/           # 双方配对
│       ├── task/           # 每日任务
│       ├── report/         # 成长报告
│       ├── subscription/   # 订阅支付
│       ├── push/           # 订阅消息推送
│       ├── track/          # 埋点上报
│       ├── admin/          # 漏斗 + 留存 API
│       ├── qrcode/         # 小程序码生成
│       └── upload/         # 图片上传
├── components/             # 旧组件（已废弃，待清理）
├── lib/                    # 服务端 lib（auth/llm/prisma/prompts/wechat-* 等）
├── shared/                 # 跨端共用（types/test-bank-*/couple-types-*/scoring/classify-*）
├── miniapp/                # Taro 小程序前端
│   └── src/
│       ├── pages/          # 11 个页面（index/test/invite/result/tasks/task/chat/profile/subscription/crisis/type）
│       ├── components/     # RadarChart + ShareCanvas
│       └── lib/            # request/auth/share/track/utm/ad
├── prisma/                 # Prisma schema + seed
├── docs/                   # 技术文档（TECH_PLAN/COUPLE_TYPES/TEST_QUESTIONS 等）
├── CLAUDE.md               # 复利工程经验固化（56+ 条）
├── DEPLOY.md               # EdgeOne Pages 部署指南
└── next.config.js          # 301 旧路由归档
```

---

## 快速开始

```bash
# 1. 安装依赖
npm install
cd miniapp && npm install && cd ..

# 2. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local 填入 LLM_API_KEY / DATABASE_URL / WECHAT_MINIAPP_APPID 等

# 3. 数据库
npx prisma db push
npx prisma db seed  # 种子 65 种 CoupleType

# 4. 启动 Web 官网 + API
npm run dev  # http://localhost:3000

# 5. 启动小程序（另一个终端）
cd miniapp
npm run dev:weapp  # 用微信开发者工具打开 miniapp/ 目录
```

---

## 定价

| 产品 | 价格 | 说明 |
|------|------|------|
| 月度订阅 | ¥39 / 月 | 到期手动续费，不自动扣款 |
| 年度订阅 | ¥298 / 年 | 省 ¥170，到期手动续费 |

订阅为一次性购买，不会自动续费。微信支付 V3 下单，支付成功后回调写入订阅状态。

---

## 部署

- **Web + API**：EdgeOne Pages，构建命令 `npm run build`，输出目录 `.next`，详细步骤见 [DEPLOY.md](./DEPLOY.md)
- **小程序**：在 `miniapp/` 执行 `npm run build:weapp`，用微信开发者工具上传，提交后台审核
- **数据库**：Neon Postgres，连接串配置在 `DATABASE_URL`，使用 `npx prisma db push` 同步 schema
- **环境变量**：在 EdgeOne Pages 控制台填入 `LLM_API_KEY` / `DATABASE_URL` / `WECHAT_MINIAPP_APPID` / `WECHAT_MINIAPP_SECRET` / `WECHAT_PAY_*` 等

---

## 项目地址

- GitHub: https://github.com/StarlitSKy88/ai-emotion-reader

---

## License

MIT - 自由使用、修改、商用。
