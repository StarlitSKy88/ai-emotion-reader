# CLAUDE.md · 问心 AI 项目知识库

> 本文件是 AI 协作的持久化记忆。每完成一个原子点或修完一个 bug，就把解法固化到这里。
> 复利工程原则：80% 时间规划与审查，20% 时间编码；修完 bug 就固化。

---

## 一、项目概述

**产品**：问心 AI · AI 驱动的情侣关系成长产品
**形态**：微信小程序（核心产品）+ Web 官网（品牌落地页）
**核心闭环**：测试题引流 → 双方配对生成类型 → 类型卡片分享裂变 → 每日任务留存 → 成长报告付费

**技术栈**：
- 后端：Next.js 14 App Router（复用现有仓库）
- 数据库：Neon Postgres + Prisma 6
- LLM：lib/llm.ts（OpenAI 兼容，复用）
- 小程序：Taro 4 + React 18（新建 miniapp/）
- 部署：EdgeOne Pages（Web）+ 微信小程序平台

**关键文档**：
- [docs/TECH_PLAN.md](docs/TECH_PLAN.md) v4.1 · 主技术方案（120 原子点）
- [docs/TEST_QUESTIONS.md](docs/TEST_QUESTIONS.md) v2 · 男女各 30 题题库
- [docs/COUPLE_TYPES.md](docs/COUPLE_TYPES.md) v2.1 · 65 种情侣类型

---

## 二、硬约束（不可违反）

1. **避免医疗/心理治疗声明**：合规要求，不可宣称「治疗/诊断/治愈」
2. **不实现恋爱/成人内容**：规避监管风险
3. **保留 SEO 友好的 Web 落地页**：维持流量入口
4. **产品形态必须是持续关系型**：不是一次性报告工具
5. **订阅定价**：¥39/月 或 ¥298/年（已弃用 ¥198 一次性）

---

## 三、工程规范

### 3.1 原子点完成定义（DoD）

每个原子点必须满足：
- [ ] 代码可运行，无 TypeScript 错误
- [ ] 验证场景跑通（见 TECH_PLAN.md 每个原子点的验证场景列）
- [ ] 新增/修改的坑已写入本文件「五、已踩过的坑」
- [ ] 不破坏已完成原子点（回归验证）

### 3.2 Prisma 规范

- **只新增表 + 可选字段**，不破坏现有数据
- 字段顺序：标量字段在关系字段之前
- 所有外键关系显式命名 `@relation("name")` 当一个模型有多个关系指向同一模型
- 迁移前必须备份（migrate 前确认 DATABASE_URL 指向正确环境）
- `prisma format` + `prisma generate` 双重验证 schema 语法

### 3.3 API 规范

- App Router 风格：`app/api/<resource>/route.ts`
- 响应统一格式：`{ success: boolean, data?: T, error?: string }`
- 所有接口需校验登录态（JWT），除 `/api/auth/*`
- LLM 调用复用 `lib/llm.ts`，不另起炉灶

### 3.4 命名规范

- 情侣类型 code：大写蛇形（`OLD_COUPLE` / `KITE_LINE` / `MM_MIRROR` / `FF_VINE`）
- 性别组合：`male-female` / `male-male` / `female-female`
- 维度代号：D1 依恋 / D2 沟通 / D3 冲突修复 / D4 共同意义 / D5 信任承诺 / D6 亲密激情

---

## 四、已验证的代码模式

### 4.1 Prisma 多关系指向同一模型

当一个模型有多个关系指向 User 时，必须用显式 relation name：

```prisma
model PairSession {
  initiatorUser   User @relation("initiatorUser", ...)
  responderUser   User @relation("responderUser", ...)
}

model User {
  pairSessionsInit  PairSession[] @relation("initiatorUser")
  pairSessionsResp  PairSession[] @relation("responderUser")
}
```

### 4.2 题库数据结构（shared/types.ts）

```typescript
interface Question {
  id: string;              // M-Q1 / F-Q1
  dimension: 'D1'|'D2'|'D3'|'D4'|'D5'|'D6'|'funny'|'open';
  stem: string;            // 题干
  options: Option[];       // 4 选项
  isFunny?: boolean;       // 无厘头趣味题
  isOpen?: boolean;        // 开放题
}
interface Option {
  label: 'A'|'B'|'C'|'D';
  text: string;
  scoring: { dimension: string; score: number };  // 维度加分
}
```

### 4.3 开放题 3 约束

1. 同一 PairSession 内 A 和 B 的 openQuestionId 必须一致
2. LLM 输出必须含 3 标签：情感浓度 + 依恋信号 + 价值观倾向
3. 同用户 30 天内重测，openQuestionId 复用上次的（存于 TestSession.openQuestionId）

---

## 五、已踩过的坑

> 每修完一个 bug 就追加到这里，避免重复踩坑。

### 5.1 Prisma 多关系指向同一模型必须用显式 relation name

当一个模型有多个关系指向 User 时，必须用 `@relation("name")`：
- PairSession 的 initiatorUser/responderUser
- Couple 的 partnerA/partnerB
- 否则 Prisma 报错 `Ambiguous relation`

### 5.2 外键 onDelete 策略要区分场景

- **核心业务数据**（PairSession/Couple）→ `Restrict`：防止误删丢失配对档案
- **用户关联**（userId）→ 可选字段 + `SetNull`：用户注销后保留匿名数据用于统计
- **配置表**（CoupleType）→ `SetNull`：类型下架时不阻塞历史数据

### 5.3 DailyTask 时区问题

- `date DateTime` 会有跨时区问题（一对情侣一方在上海一方在洛杉矶）
- 必须改为 `date DateTime @db.Date`（纯日期）+ 单独 `timezone` 字段
- 应用层用情侣约定时区生成 date

### 5.4 题库评分规则必须严格执行

- D1 依恋题：S=25 / A=10 / D=5 / F=0（不允许 18 等中间值）
- D2-D6 维度题：正向 20-25 / 负向 0-10
- 男女对应题目评分必须对称（F-Q 与 M-Q 一致）
- 无厘头题加分维度应归属其所在题组（如 Q5 在 D1 题组则加 D1 分）

### 5.5 开放题 3 约束必须函数层面支持

- 同 couple 同题：PairSession 业务层保证
- 3 维度统一：数据层 targets 字段保证
- 30 天内重测复用同题：pickOpenQuestion 必须支持 `preferId` 参数

### 5.6 文档术语必须全局统一

- v2.1 核心决策是「去角色标签化」，术语必须是「三段式意象化」而非「三段式角色化」
- 任何文档中出现的「角色化」字样都会触发审查报错
- 跨库重名（如「双子星型」在异性恋和男男都出现）必须改名
- emoji 不能跨类型重复（如 MM-11 和 MM-13 都用 🌙）

### 5.7 题库版本兼容

- TestSession 必须存 `bankVersion` 字段
- AnswersPayload 应含 `bankVersion` 用于版本校验
- 题库升级时旧 answers 需 migrate 函数，否则评分会按新分值计算导致错误

### 5.8 A 邀请多人场景约束

- PairSession.initiatorId 必须 `@unique`：防止 A 用同一份 TestSession 邀请多人
- 业务上一份答题只能对应一个配对关系
- 如需重新邀请，必须重新答题生成新 TestSession

### 5.9 小程序 AppConfig 与 PageConfig 字段不能混用

- `enableShareAppMessage` / `enableShareTimeline` 是 **PageConfig** 字段，不能写在 app.config.ts
- AppConfig 中声明会被 tsc 报错 `TS2353: Object literal may only specify known properties`
- 分享配置必须放在各页面的 `index.config.ts` 中按需开启

### 5.10 微信小程序码 scene 字段位置

- `Taro.useLaunch(options)` 的 `options.scene` 是 **数字**（场景值，如 1047 表示扫码进入）
- 真正的小程序码 scene 字符串在 `options.query.scene`（string，已 encodeURIComponent 编码）
- 类型签名必须用 `{ query?: { scene?: string } }`，直接 `options as { scene?: string }` 会触发 TS2352

### 5.11 defineConstants 注入的全局变量需声明类型

- Taro `config/dev.ts` 与 `config/prod.ts` 通过 `defineConstants` 注入 `API_BASE_URL`
- 但 TypeScript 编译期没有对应全局类型声明，tsc 报 `TS2304: Cannot find name 'API_BASE_URL'`
- 必须在 `miniapp/src/global.d.ts` 中 `declare const API_BASE_URL: string;`

### 5.12 配对机制双层解锁不能被付费绕过

- 产品定义：A 答完看不到结果，B 主动分享才解锁 A 的视图
- 必须区分两层：
  - `unlocked`（B 已分享）= 基础结果可见（默契度 + emoji + name + oneLiner）
  - `paid`（A/B 付费）= 深度内容可见（描述 + 风险 + 建议 + AI 总结 + 备选类型）
- A 视角 `!unlocked` 时**不能显示付费 CTA**，否则 B 分享机制形同虚设
- 付费前置校验：`unlock()` 函数必须先检查 `data.unlocked === true`

### 5.13 B 答完测试必须直接跳 result 页，不经过 invite 页

- 原设计：B 扫码 → invite 页 → test 页 → invite 页（B 视角）→ result 页，三段跳转
- 简化为：B 扫码 → test 页（带 inviterTestSessionId）→ submit 后端创建 PairSession → result 页
- invite 页只剩 A 等待场景，删除 B 视角分支
- test 页 submit 时必须传 `inviterTestSessionId` 给后端，否则配对关系断裂

### 5.14 接口 interface 不能与 import 的组件同名

- `import { Progress } from '@tarojs/components'`（值空间，组件）
- `interface Progress { ... }`（类型空间，本地接口）
- TS 允许值/类型分空间共存，tsc 不报错，但极易误导维护者
- 本地接口应改名为 `TestProgress` / `AnswerProgress` 等，与组件名解耦

### 5.15 前端 PairStatus 不能与 shared PairStatus 枚举冲突

- shared/types.ts 定义 `PairStatus = 'pending' | 'completed' | 'expired'`
- 前端若需要「B 已分享」状态，**不能**在本地加 `'unlocked'` 到 status 枚举（后端不会返回）
- 应新增独立布尔字段 `unlocked?: boolean`，与 status 解耦
- 判断「A 可看结果」用 `info.unlocked === true`，不用 `info.status === 'unlocked'`

### 5.16 B 模式 PairSession 创建必须用事务包裹

- 执行顺序：先做所有只读前置校验（inviter 存在 / 自配对 / 未被配对 / 性别组合 / 默契度计算）→ 再用 `prisma.$transaction` 原子包裹 TestSession.create + PairSession.create
- 不用事务会导致 PairSession 创建失败（如 initiatorId @unique 冲突）时 TestSession 成为孤儿数据
- 事务内必须用 `tx` 客户端，不能用全局 `prisma`

### 5.17 inviterGender 必须来自 TestSession.gender，不能来自 User.gender

- 邀请页分享 URL 中的 `inviterGender` 决定 B 端代词替换风格（mixed/neutral）
- 必须调用 `GET /api/test/session/{testSessionId}` 取 A 的 TestSession.gender
- **不能**用 `getCurrentUser().gender`（User 表 profile 性别），两者可能不一致
- 不一致后果：同性场景误判为异性，代词显示「他/她」而非「TA」

### 5.18 代词替换正则必须排除「他们/她们」

- `replacePronounInStem` 用 `/他(?!们)/g`、`/她(?!们)/g` 负向先行断言
- 直接 `/他/g` 会把「他们」→「TA们」
- 替换顺序：先替换「他的/她的」→「TA的」，再替换独立「他/她」→「TA」
- 当前题库未出现「他们/她们」，正则改进为防御性措施

### 5.19 服务端必须校验答案完整性

- `calculateDimensionScores` 返回 `incomplete` 和 `skippedQuestions`
- 服务端必须检查 `scoring.incomplete`，命中则返回 400 + skippedQuestions 列表
- **不能**信任前端 `Object.keys(answers).length < total` 拦截，可被绕过
- 跳题会导致维度分失真 → 默契度失真 → 类型匹配错误

### 5.20 防自配对

- B 模式 submit 时必须校验 `inviter.userId !== userId`
- 否则 A 拿自己的 testSessionId 邀请自己，initiatorUserId === responderUserId
- 失败返回 400 "不能与自己配对"

### 5.21 JWT_SECRET 生产环境强制要求

- 开发环境保留默认值 `'wenxin-ai-dev-secret-change-in-prod'` 方便本地调试
- 生产环境（`NODE_ENV === 'production'`）模块加载时检查，未配置直接 throw
- 弱默认值会公开 JWT 签名密钥，任何人可伪造 token 绕过登录态校验

### 5.22 微信小程序 SVG 渲染必须用 base64 data URI

- 小程序 `<Image>` 组件对 `data:image/svg+xml,${encodeURIComponent(svg)}` URL-encoded 形式支持不稳定，真机可能不渲染
- 必须改用 `data:image/svg+xml;base64,${base64}`
- 小程序环境无 `btoa`，需用 `Taro.arrayBufferToBase64`：
  ```typescript
  function svgToBase64(svg: string): string {
    const escaped = encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
    const bytes = new Uint8Array(escaped.length);
    for (let i = 0; i < escaped.length; i++) bytes[i] = escaped.charCodeAt(i);
    return Taro.arrayBufferToBase64(bytes.buffer);
  }
  ```
- UTF-8 编码正确处理中文（维度标签「依恋」等）

### 5.23 B 分享按钮必须同步落库 + 重新拉取完整数据

- B 视角「分享给 TA」按钮同时使用 `openType='share'`（拉起微信分享面板）和 `onClick`（调 POST /api/pair/share 落库）
- **不能**只用 openType='share'，否则后端 resultSharedToInitiator 永远 false，A 端永远不解锁
- 落库成功后**必须**重新调 `loadResult()` 拉取完整 ResultData，**不能**仅 `setData({ ...data, unlocked: true })`
- 原因：B 视角 !unlocked 时后端返回最小信息（compatibility=0、matched 全空），仅改 unlocked 字段会导致渲染空白默契度+空白类型卡

### 5.24 后端 ResultData 必须透出 genderCombo

- 前端 result 页用 genderCombo 判断是否显示「专属类型」徽章（同性场景 male-male / female-female）
- lib/pair-result.ts 的 ResultData 接口必须包含 `genderCombo?: string`
- buildResultData 返回对象必须追加 `genderCombo: pair.genderCombo`
- genderCombo 不泄露答案，未解锁时也可安全返回

### 5.25 /api/pair/mine 必须返回 resultSharedToInitiator

- 首页用 /api/pair/mine 显示状态卡，需要区分「B 已答但未分享」和「B 已分享」
- status='completed' 仅代表 B 答完，不代表 B 已分享
- 必须返回 resultSharedToInitiator 字段，前端据此区分文案：
  - completed && !resultSharedToInitiator → "TA 答完了，等 TA 分享"
  - completed && resultSharedToInitiator → "你们的结果出来了"

### 5.26 微信支付回调必须校验金额

- notify 路由不能只判断 trade_state === 'SUCCESS'，必须校验 `payResult.amount?.total === UNLOCK_AMOUNT_FEN`（3900）
- 否则攻击者可构造低额支付伪造成功回调
- 配合验签缺失，固定金额可被猜出，必须双校验

### 5.27 B 视角分享按钮 onClick 与 openType='share' 并行

- `<Button openType='share' onClick={shareToPartner}>` 两者都会触发，不冲突
- openType='share' 拉起微信分享面板（无法监听用户是否真的发出去）
- onClick 调 POST /api/pair/share 落库（以「点击即意图」为准）
- 微信限制：无法监听分享成功回调，只能用点击意图近似

### 5.28 同性类型 attachmentCombo 格式必须与 type-matcher 一致

- `lib/type-matcher.ts` 构建的 `attachmentCombo` 是单字母英文格式 `'S×S'` / `'A×D'`
- 同性类型库（`couple-types-male-male.ts` / `couple-types-female-female.ts`）原用中文格式 `'焦虑 × 焦虑'`，三元组精确匹配永远失败，全部回退到相似度匹配
- **统一规则**：所有类型库 `attachmentCombo` 用英文格式，多组合用 `|` 分隔（如 `'A×A|S×S'`），通配用 `'*×*'`
- `matchByTuple` 用 `attachmentComboMatches` 替代严格相等，支持 `|` / `/` / `*×*` 展开

### 5.29 匿名友好的接口前端必须传 requireAuth=false

- `miniapp/src/lib/request.ts` 的 `http.post` 默认 `requireAuth=true`，无 token 时 `Taro.navigateTo` 跳登录页并 throw
- 后端 `/api/pair/track` 允许匿名（sharerUserId=null），但前端默认 requireAuth=true 导致匿名用户被跳转登录页，分享引流追踪链路断裂
- **修复**：所有 `/api/pair/track` 调用必须传第三参数 `false`：`http.post('/api/pair/track', body, false)`

### 5.30 ResultData 后端必须 include 用户信息并返回 myNickname/myAvatar

- result 页 `ResultData` 接口定义了 `myNickname/myAvatar/partnerNickname/partnerAvatar`，用于双方头像区域和 ShareCanvas 绘制
- `lib/pair-result.ts` 的 `buildResultData` 必须 `include: { initiatorUser, responderUser }`（select nickname + avatarUrl）
- 根据 `isInitiator` 映射 my/partner：`isInitiator ? initiatorUser : responderUser` 作为 myUser
- **未 unlocked 分支不返回这些字段**（保持最小信息，不泄漏对方信息）

### 5.31 分享变体文案占位符必须替换

- `shared/share-variants.ts` 的 `boast` 模板原含字面量 `"全国仅 N%"`，N 未被实际百分比替换
- `ShareVariantContext` 必须含 `estimatedRatio?: number` 字段，模板用 `Math.round(ctx.estimatedRatio * 100)` 替换
- `lib/pair-result.ts` 的 `MatchedType` 接口必须含 `estimatedRatio`，`resolveMatchedType` 返回时带上
- 调用方（result 页 `pickShareVariant`）必须传 `estimatedRatio: data.matched.estimatedRatio`

### 5.32 同性专属类型详情页必须限制访问（!isPublic 不渲染深度内容）

- `miniapp/src/pages/type/detail.tsx` 通过 `getCoupleTypeByCode(code)` 查询，对 code 无校验
- 任意用户可通过 `/pages/type/detail?code=MM_MIRROR` 直接访问同性专属类型完整内容
- **修复**：`!typeInfo.isPublic` 时仅显示 emoji + name + oneLiner + 提示卡片，不渲染 description/hiddenRisks/growthAdvice/radarProfile/shareCopy，禁用复制文案按钮

### 5.33 result 页「专属类型」标签仅在 paid 后显示

- result 页类型卡原对同性组合显示「专属类型」标签，unlocked 但未 paid 时用户截图发朋友圈会泄漏同性关系
- **修复**：标签显示条件改为 `data.paid && (genderCombo === 'male-male' || genderCombo === 'female-female')`
- ShareCanvas 已正确处理（`!isSameSex` 时不画 typeName），result 页 UI 需同步

### 5.34 小程序 Canvas event 没有 target.closest，用 stopPropagation 替代

- 微信小程序 event 对象没有标准 DOM 的 `target.closest` 方法
- `(e.target as HTMLElement).closest('.xxx')` 在真机会抛 `TypeError: closest is not a function`
- **修复**：遮罩层 `onClick={onClose}`，内容层 `onClick={(e) => e.stopPropagation()}`（Taro 支持 `e.stopPropagation()`）

### 5.35 /api/pair/track 需校验 variant enum 和 utm 长度

- 路由允许匿名（sharerUserId=null），不校验参数格式可被注入超长字符串或刷量
- **修复**：`variant` 用 enum 校验（`['boast','selfmock','helpseek','mystery']`），utmSource/utmMedium/utmCampaign 限制 ≤64 字符
- 不做 IP 限流（需 Redis，超出 Phase 3 范围）

### 5.36 submit 路由需校验 inviter.dimensions 完整性

- `inviter.dimensions as DimensionScores` 直接强转，旧数据 `dimensions = {}` 会导致 D1-D6 为 undefined
- `matchCoupleType` 内 `dimsA.D1` 为 undefined → NaN → 写入数据库 Int 字段报错或写入 0
- **修复**：新增 `isValidDimensions` 类型守卫，校验 D1-D6 全部为数字且非 NaN，异常返回 400

### 5.37 Canvas 多行文本绘制避免朋友圈文案截断

- momentsCopy 普遍 40-60 字符，单行截断到 24 字符 + 「…」会丢失核心情绪传达
- **修复**：实现 `drawMultiLineText(ctx, text, x, y, maxLines, maxCharsPerLine, lineHeight)`，最多 2 行每行 18 字符
- 最后一行有剩余文本时加「…」

### 5.38 相册权限 openSetting 后需检查 authSetting 并重试保存

- `Taro.openSetting()` resolve 后不检查 `authSetting['scope.writePhotosAlbum']`，用户开启权限后回来什么都没发生
- **修复**：`openSetting` 后检查 `settingRes.authSetting['scope.writePhotosAlbum']`，true 则继续 `saveImageToPhotosAlbum`，false 则 toast「未开启相册权限」
- `draw()` 失败时立即 toast 退出，不进入权限检查流程

### 5.39 Canvas 多行文本截断需先累积字符再判断断行（Phase 3 复审 B-1）

- 原实现 `for (ch of text) { if (current.length >= max) { lines.push(current); current=''; if (lines.length >= maxLines-1) break; } current += ch; }` 中 `break` 在 `current += ch` 之前触发，导致第 N*max 字符丢失，且 `maxLines-1` 提前 break 使第二行永不绘制
- **修复**：先 `current += ch` 再判断长度，达 `maxLines` 行后 `break` 丢弃剩余字符，循环后用 `lines.join('').length < text.length` 判断是否加省略号
- **教训**：Canvas 文本绘制逻辑必须用具体 case 模拟验证（如 40 字符 / maxLines=2 / maxCharsPerLine=18），不能只看代码直觉

### 5.40 微信支付回调生产环境必须 fail-closed（Phase 3 复审 B-2）

- 原实现生产环境 `console.warn` 后 `return true` 临时放行，未做真实 RSA-SHA256 验签，攻击者可伪造回调任意解锁 PairSession
- **修复**：移除「临时放行」，改为 `crypto.createVerify('RSA-SHA256')` + `WECHAT_PAY_PLATFORM_CERT_PEM` 环境变量验签；未配置公钥时 `return false` 拒绝
- **原则**：安全相关代码 fail-closed（拒绝）优于 fail-open（放行）；TODO 注释不能成为生产环境放行的理由

### 5.41 同性隐私保护需覆盖 Canvas 所有识别信号（Phase 3 复审 W-1）

- 原实现仅隐藏 `typeName`，但 `typeEmoji`（如 🪞）、`typeOneLiner`（如「我们太像了，像照镜子一样互相较劲」）、`radarScoresA`（雷达图形状）仍可识别类型
- **修复**：`isSameSex=true` 时，emoji 用通用 ❤ 替代，oneLiner 用「我们的关系类型有点特别」占位，雷达图整段不绘制
- **教训**：隐私保护审查需逐字段过一遍识别信号，不能只看「名字」字段；雷达图形状、emoji、典型文案都是类型指纹

### 5.42 分享变体触发条件不能依赖未传字段（Phase 3 复审 W-2）

- 原实现 `helpseek` 变体要求 `stage === 'crisis'`，但 `ResultData` 接口不含 `stage` 字段，前端传 `undefined`，导致 helpseek 永不触发（死代码）
- **修复**：改为按 `compatibility` 区间选择（<40 selfmock / 40-60 helpseek / >=60 mystery），语义合理：中等默契度改善空间最大
- **教训**：变体选择函数的输入字段必须与上游数据结构对齐；新增字段需确认上下游是否真正传递

### 5.43 百分比计算需区分 0-1 小数与 0-100 整数（Phase 3 复审 W-3）

- `Math.round(ctx.estimatedRatio * 100)` 对异性类型正确（0.18 → 18），但对同性类型会得到 1200%（同性 estimatedRatio 已是 0-100 整数）
- **修复**：`ctx.isSameSex ? Math.round(ctx.estimatedRatio) : Math.round(ctx.estimatedRatio * 100)`
- **教训**：同一字段在不同性别组合下单位不同时，必须在所有使用点统一区分；类型库设计时同性/异性字段单位应保持一致

### 5.44 并发首次分享判断需用 updateMany + where 条件（Phase 3 复审 W-4）

- 原实现先 `findUnique` 读 `resultSharedToInitiator`，再 `update`，并发场景下两个请求都读到 false，都执行 update 并返回 `firstTime: true`
- **修复**：`prisma.pairSession.updateMany({ where: { id, resultSharedToInitiator: false }, data: { resultSharedToInitiator: true } })`，根据 `result.count > 0` 判断首次
- **教训**：「读-改-写」操作在并发下不原子；PostgreSQL `UPDATE ... WHERE` 是原子的，用 `updateMany` + `where` 条件利用影响行数判断首次

### 5.45 TaskResponse 必须有 `@@unique([taskId, userId])` 防并发重复提交（Phase 4 W-1）

- 仅靠应用层 `task.responses.find(r => r.userId === userId)` 检查不能防止并发：A 几乎同时发出两个 POST，两者都查不到 existing，双双进入 `prisma.$transaction` 写入
- **修复**：schema 上加 `@@unique([taskId, userId])`，事务里捕获 Prisma `P2002` 唯一约束冲突返回 400「今日已提交过回应」
- **教训**：所有「一个用户对一个资源只能创建一条」的语义，都必须在 DB 层加唯一约束；应用层 find+create 是 check-then-act 反模式；`userId` 可空时 PostgreSQL partial unique 自动允许多个 null 共存，符合「用户注销后保留匿名响应」的需求

### 5.46 summary 路由的首次写入权抢占用 `updateMany + where: { aiSummary: null }`（Phase 4 W-2）

- A、B 几乎同时调 `/api/task/[taskId]/summary` 时，两个请求都看到 `aiSummary` 为 null，双双调 LLM、双双触发 task_summary 推送 → 浪费 LLM 成本 + 双重推送骚扰用户
- **修复**：先调 LLM 生成结果，再用 `prisma.dailyTask.updateMany({ where: { id, aiSummary: null }, data: { aiSummary: JSON.stringify(result) } })` 抢占写入权；`count > 0` 才是首次写入方，触发推送；`count = 0` 表示被并发抢先，读已生成的 aiSummary 返回
- **教训**：「调外部 API + 写 DB」的两步操作不能在并发下保证只执行一次；LLM 调用成本远低于 DB 写入，宁可多调一次 LLM，由 `updateMany + where` 保证只有一个写入方；推送等副作用必须严格绑定到「首次写入方」标志位

### 5.47 cron 推送过滤条件按「本人完成状态」而非「双方都完成」（Phase 4 W-3）

- 原逻辑判断 `task.statusA === done && task.statusB === done` 才推送，意味着 A 完成后不会收到 9:00 推送提醒（因为 B 未完成时双方都不推），违背「daily_task 是晨间提醒未完成者」的设计意图
- **修复**：用 `couple.partnerAId === sub.userId` 映射到 `task.statusA/statusB` 判断 userDone，仅当「本人未完成」时推送
- **教训**：模板消息的场景决定过滤条件：daily_task 是「提醒未完成者」（按本人状态），task_summary 是「双方完成时通知双方」（按双方状态）；推送过滤条件必须与场景语义对齐

### 5.48 serverless cron 串行 100 条会超时，改 chunk 并发 + Promise.allSettled（Phase 4 W-6）

- Vercel/EdgeOne 等 serverless 函数默认 10s/60s 超时，串行 `for (job of jobs) await sendOne(job)` 处理 100 个用户时每个微信 API 调用 1-3s，总耗时 100-300s 必超时
- **修复**：`const CHUNK_SIZE = 10; for (let i = 0; i < jobs.length; i += CHUNK_SIZE) { const chunk = jobs.slice(i, i + CHUNK_SIZE); const settled = await Promise.allSettled(chunk.map(sendOne)); }`，每批 10 个并发，错误隔离
- **教训**：serverless 函数处理批量任务必须用 chunk 并发；`Promise.allSettled` 而非 `Promise.all` 保证单条失败不阻塞整批；CHUNK_SIZE 取 10-20 是微信 API 限流安全值；单批失败记录到 `results.errors[]` 不抛出

### 5.49 微信 access_token 出现 40001/42001 必须清缓存重试一次（Phase 4 W-7）

- 进程内缓存的 access_token 可能因「微信后台主动失效」「token 提前过期」「多机环境其他机器刷新导致旧 token 失效」等原因失效，原实现遇到 40001/42001 直接返回失败
- **修复**：拆分 `doSendSubscribeMessage`（实际发送）和 `sendSubscribeMessage`（外层包装）；外层包装捕获 40001/42001 → `cachedAccessToken = null` 清缓存 → 重试一次 `doSendSubscribeMessage`；同时给 fetch 加 5s 超时避免 hang
- **教训**：所有进程内缓存的远程 token 都要处理「缓存值与远端不一致」场景：失败码 40001（access_token 无效）/42001（access_token 过期）触发清缓存重试一次；fetch 必须显式超时，否则微信 API 偶发 hang 会拖垮整个 cron 批次；重试只重试一次避免死循环

### 5.50 aiSummary 字段是 JSON 字符串，前端不能直接渲染（Phase 4 B-1）

- `prisma.dailyTask.aiSummary` 是 `String? @db.Text`，存的是 `JSON.stringify(TaskSummaryResult)`；前端 `{task.aiSummary}` 直接渲染会显示 `{"compatibility":75,"summary":"..."}` 裸 JSON 字符串，丑陋且暴露数据结构
- **修复**：前端横幅改为引导文案「点击查看今日默契度总结」，跳转到 task detail 页用 `/api/task/[id]/summary` 返回的解析后对象渲染
- **教训**：DB 存 JSON 字符串的字段（aiSummary/dimensions/answers/preferences）一律不能在前端直接 `{field}` 渲染；前端展示前必须 `JSON.parse` 或调 API 拿到结构化对象；后端返回 API 时也要把 JSON 字符串字段 parse 成对象再返回，避免前端处理裸字符串

### 5.51 订阅信息复用 `User.subscription` Json 字段，不独立建表（Phase 5.3）

- MVP 阶段每个用户只有 1 条当前订阅记录，用 `User.subscription: Json?` 存储足够；V2 需要历史订阅记录/退款/续费日志时再独立建 `Subscription` 表
- **结构**：`{ plan, status, currentPeriodStart, currentPeriodEnd, autoRenew, lastOutTradeNo, pendingOrder? }`，对齐 `shared/types.ts` 的 `SubscriptionInfo`
- **解析**：`parseSubscriptionInfo(raw)` 必须安全转换 Prisma Json（兼容 `{}`/`null`/字段缺失的旧数据），不能直接 `as SubscriptionInfo`
- **教训**：Json 字段是「Schema-less」的，所有读取都要走 `parseXxx` 安全转换函数；写入时用 `as never` 绕过 Prisma 类型检查但运行时必须是合法 JSON

### 5.52 `pendingOrder` 防伪造回调机制（Phase 5.3.3）

- 微信支付回调只靠 `out_trade_no` 反解 userId 不安全：攻击者拿到自己的 `out_trade_no` 格式后，可伪造他人 userId 的回调激活任意用户订阅
- **机制**：下单时在 `User.subscription.pendingOrder = { outTradeNo, plan, createdAt }` 写入；回调时校验 `pendingOrder.outTradeNo === out_trade_no`，不匹配直接返回 SUCCESS（幂等 + 防伪造）
- **激活后**：`activateSubscription` 内部 `prisma.user.update` 用新 `SubscriptionInfo` 整体覆盖 subscription 字段，`pendingOrder` 字段自动消失（因为 `parseSubscriptionInfo` 不解析它）
- **教训**：支付回调必须「服务端可验证的 pending 状态」+「金额校验」+「签名校验」三重防护，不能只信 `out_trade_no`

### 5.53 危机检测三档等级 + high 级别不调 LLM（Phase 5.4）

- **三档**：high（明确自杀/自残关键词，26 个）→ middle（强烈负面情绪，20 个）→ low（正常）
- **high 不调 LLM**：高风险场景下 LLM 可能产生不当回应（如误解读、淡化、引导自伤方法），直接返回固定话术 `HIGH_RISK_RESPONSE` + 跳转资源页
- **middle 叠加边界 Prompt**：`CRISIS_BOUNDARY_PROMPT` 强制 LLM 承认情绪/不评判/不淡化/不引导自伤/温和引导专业帮助/不绝对化承诺
- **关键词检测「宁可信其有」**：「解脱」「不想继续」「折磨」等词在正常语境会误判，但危机场景下误判代价远低于漏判，可接受
- **教训**：涉及用户安全的场景，LLM 不能是唯一判断层；必须有规则引擎前置过滤 + 高风险场景绕过 LLM + 固定话术兜底

### 5.54 报告 LLM 叙事缓存在 `Couple.profile.reports`，保留最近 10 份（Phase 5.2）

- 报告 LLM 调用昂贵（1024 tokens），同一天内多次访问应读缓存；缓存键 `report_${range}_${endDate}`，endDate 变化（第二天）自动失效
- **存储位置**：`Couple.profile: Json?` 的 `reports` 子对象，不独立建 `Report` 表（MVP 阶段足够）
- **保留 10 份**：每次写入新缓存时按 `generatedAt` 降序排序取前 10，避免 `profile` 字段无限增长
- **免费/付费分层**：免费用户返回 `aggregation` + 兜底 `title/blessing`（付费墙 CTA）；订阅用户才调 LLM 生成完整 `narrative`
- **教训**：LLM 生成内容缓存要考虑「失效条件 + 容量上限 + 分层返回」三要素；Json 字段做缓存时必须有 trim 逻辑，否则会无限膨胀

### 5.55 微信小程序订阅是一次性购买，文案不能写「自动扣费」（Phase 5 B-1）

- 微信小程序订阅产品（非自动续费）实际是「一次性购买」，到期后需用户手动续费，不会自动扣款
- **违规风险**：文案写「续费会在到期前 24 小时自动扣费」+「取消自动续费」链接，违反消费者权益保护法（虚假宣传 + 误导消费者）
- **正确文案**：「到期后需手动续费，不会自动扣款」+「如有疑问可在「我的 → 关于」联系客服」
- **教训**：支付/订阅类文案必须与实际支付方式严格对齐；微信小程序订阅 vs 微信支付分自动续费是两种不同产品，文案要区分；删除功能链接时同步删除对应的 `handleXxx` 函数（避免死代码）

### 5.56 miniapp 与 server-side lib 资源数据为镜像副本，需注释说明同步关系（Phase 5 W-2）

- `miniapp/src/pages/crisis/index.tsx` 的 `RESOURCES` 与 `lib/crisis-detector.ts` 的 `CRISIS_RESOURCES` 数据重复
- **不抽取共用模块的原因**：miniapp 独立打包，不引用 server-side `lib/`；Taro 跨端打包限制 + 服务端 lib 含 Prisma 等浏览器端不可用依赖
- **修复**：在 miniapp 端加注释「RESOURCES 与 lib/crisis-detector.ts 的 CRISIS_RESOURCES 为镜像副本，修改热线时需同步两处」
- **教训**：跨端项目（Next.js + Taro）的常量/配置数据，要么放 `shared/` 目录两端共用（需保证无 server-only 依赖），要么明确标注镜像关系；不能默默重复定义，否则改一忘一导致数据不一致

### 5.57 小程序码生成用 wxacode.getUnlimited + 1h 内存缓存 + SVG 占位降级（Phase 6.2）

- `lib/wechat-mp.ts` `getMiniProgramQRCode` 调 `wxa/getwxacodeunlimit`，scene 最长 32 字符
- **缓存**：`qrcodeCache` Map<scene::page, {buffer, expiresAt}>，TTL 1 小时，避免高频调微信接口
- **错误处理**：40001/42001（access_token 失效）清缓存重试一次（同 5.49 机制）；其他错误抛出由调用方降级
- **降级**：`/api/qrcode` 失败时返回 SVG 占位图（200，Cache-Control 60s 短缓存便于恢复），避免落地页裸奔
- **教训**：所有外部依赖（微信 API）的图片资源接口，必须有同步降级方案（如 SVG 占位），不能让上游故障导致落地页视觉残缺

### 5.58 SEO 三件套：sitemap.ts + robots.ts + JSON-LD（Phase 6.3）

- **sitemap.ts**：仅暴露官网落地页 `/`，不暴露小程序内页（不在 Web 抓取范围）和旧路由（已 301 归档）
- **robots.ts**：allow `/` + disallow `/api/ /auth/ /chat/ /admin/`，引用 sitemap.xml + host
- **JSON-LD**：在 layout.tsx `<head>` 注入 WebSite + Product（含 Offer 列表）结构化数据，`dangerouslySetInnerHTML` 渲染
- **metadataBase**：`new URL(SITE_URL)` 让 canonical / openGraph.url 自动拼接绝对路径
- **教训**：App Router 的 metadata API 自动生成 `<meta>`，但 JSON-LD 必须手动注入 `<script type="application/ld+json">`；Product 结构化数据可让 Google 富摘要展示价格

### 5.59 旧路由用 next.config.js redirects() 永久 301 归档，不返回 404（Phase 6.5）

- 废弃路由（/auth/* /chat/* /api/summary /api/analyze /api/sessions/*）`permanent: true` 301 重定向到 `/`
- **不返回 404 的原因**：外链可能引用旧 URL，404 会产生死链影响 SEO；301 把权重传递到新页面
- **教训**：产品形态迁移（单次报告 → 订阅制）时，旧路由必须 301 归档而非删除，保留外链权重 + 用户书签可用

### 5.60 埋点 SDK 设计：fire-and-forget + 事件名规范 + 字符串截断 + 批量 createMany（Phase 6.6）

- **fire-and-forget**：`trackEvent` 用 `void http.post(...)`，错误 `console.warn` 吞掉，不阻塞业务流程
- **事件名规范**：`object_action`（如 `test_start` / `task_complete` / `subscribe_success`），正则 `/^[a-z_]{1,64}$/` 校验
- **属性 sanitize**：字符串截断 256 字符，仅保留 string/number/boolean，其他类型跳过（防 SQL 注入 / 超长字段）
- **批量上限**：单次请求 ≤20 条事件（防批量刷量）
- **批量插入**：`prisma.trackEvent.createMany` 一次性写入，不逐条 insert
- **教训**：埋点 SDK 必须独立于业务逻辑（失败不影响主流程）+ 服务端二次校验（不信任客户端）+ 严格白名单（事件名 + 属性类型）

### 5.61 Admin 鉴权 fail-closed + timingSafeEqual 防时序攻击（Phase 6.7/6.8 B-2）

- `lib/admin-auth.ts` `verifyAdminToken`：未配置 `ADMIN_TOKEN` 时直接返回 false（fail-closed，避免 admin 路由裸奔）
- **时序攻击**：`token === expectedToken` 字符串比较非常数时间，攻击者可通过响应耗时逐字符爆破 token
- **修复**：`crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` 常数时间比较，长度不等时直接返回 false（仍常数时间）
- **教训**：所有 token/密码比较必须用 `timingSafeEqual`，不能用 `===`；fail-closed 是默认安全策略（未配置即拒绝）

### 5.62 留存曲线用 raw SQL cohort 查询 + Node 层双重循环计算（Phase 6.8）

- **cohort 查询**：`SELECT user_id, DATE_TRUNC('day', MIN(created_at)) FROM track_events WHERE ... GROUP BY user_id HAVING ...` 找出 cohort 窗口内首次出现的用户
- **活跃日查询**：`SELECT user_id, DATE_TRUNC('day', created_at) FROM track_events WHERE user_id = ANY(...) GROUP BY user_id, day` 一次性查所有 cohort 用户的所有活跃日
- **留存计算**：Node 层双重循环（cohortSize × retentionDays），用 Map<userId, Set<dayStr>> 判断每天是否活跃
- **教训**：Prisma 不支持「first appearance」查询，用 raw SQL + `DATE_TRUNC` 高效实现；MVP 阶段 Node 层循环可接受（90×60=5400 次迭代），V2 用纯 SQL `generate_series` 优化

### 5.63 落地页文案禁止虚构数据，违反广告法（Phase 6.1 B-1）

- 原文案「已为 5,237+ 对情侣服务 · 平均默契度提升 23%」是**虚构数据**，违反《广告法》第二十八条（虚假商业宣传）
- **修复**：改为「内测中 · 每一对反馈都在让产品变得更好」
- **教训**：所有用户可见的数据声明（用户数 / 效果指标 / 排名）必须有数据来源；内测阶段用「内测中 / 早期用户」等模糊表述，不能用具体数字虚构社会证明

### 5.64 转化漏斗 landing_visit 用独立事件，不复用 page_view（Phase 6.7 W-2）

- **问题**：`/api/admin/funnel` 第一阶段 `landing_visit` 原用 `page_view` 事件聚合，但小程序首页也用 `page_view`（`trackPageView('pages/index/index')`），导致重复计数
- **修复**：落地页 SSR 加客户端 `<script>` beacon 上报独立 `landing_visit` 事件（`fetch keepalive`），funnel API 改用 `landing_visit` 事件聚合
- **教训**：埋点事件名必须场景唯一，不能跨端复用（Web 落地页访问 ≠ 小程序首页访问）；`fetch keepalive` 类似 `sendBeacon`，页面关闭也能完成上报

### 5.65 虚拟商品不能用微信支付 JSAPI，订阅服务可以（14 维度审查 B-WC-1）

- **问题**：解锁功能用微信支付 JSAPI 收 39 元，但 Android 虚拟商品必须用 `wx.requestVirtualPayment`，iOS 不允许虚拟支付；违反平台规范会被拒审
- **修复**：MVP 阶段移除解锁功能（删 `/api/pair/pay` + `/api/wechat/pay/notify`，result 页移除解锁按钮，pair-result.ts `paid = true`），深度内容免费开放；V2 接入虚拟支付
- **教训**：微信小程序虚拟商品支付有平台限制——虚拟商品（解锁/会员内容）Android 用 `wx.requestVirtualPayment`、iOS 不允许；订阅服务（连续会员）可用微信支付 JSAPI；MVP 阶段优先合规上线，深度变现留 V2

### 5.66 admin 敏感页面必须客户端组件 + 显式 token 输入（14 维度审查 B-S-1）

- **问题**：`app/admin/dashboard/page.tsx` 是服务端组件，页面 URL 本身无鉴权层，任何人访问 URL 就能看到页面骨架（虽然 API 请求会被 `verifyAdminToken` 拒，但页面结构泄露 + 体验差）
- **修复**：改为客户端组件（'use client'）+ token 输入界面 + localStorage 存 `admin_token` + fetch 加 `Authorization: Bearer ${token}` 头 + 401 清空 localStorage 回到输入界面 + 退出登录按钮
- **教训**：Next.js 服务端组件页面本身无鉴权层，敏感页面必须客户端组件 + 显式 token 输入；token 存 localStorage（非 cookie，避免 SSR 泄露）；401 必须清空重定向，避免失效 token 卡死

### 5.67 用户自由输入入口必须接入危机检测，high 级别不调 LLM（14 维度审查 B-U-2/B-E-1）

- **问题**：开放题是用户自由输入，可能含自杀/自残/他伤信号，未接入 `detectCrisis` 会错过危机干预窗口；LLM 在高风险场景下可能产生不当回应
- **修复**：`test/submit` 路由在 openAnswer 校验后调用 `detectCrisis(body.openAnswer).level`，返回 `crisisLevel` 字段；前端 submit 成功后判断 `crisisLevel === 'high'` 跳 `/pages/crisis/index`（不调 LLM，不跳 result/invite）
- **教训**：任何用户自由输入入口（开放题/聊天/日记/任务回应）都必须接入危机检测；high 级别不调 LLM 直接跳资源页（避免 LLM 在高风险场景下产生不当回应）；middle 级别调 LLM 但叠加危机边界 Prompt；low 正常流程

### 5.68 LLM 调用必须显式设置 temperature，不依赖 vendor 默认值（14 维度审查 B-PQ-1）

- **问题**：`streamOpenAI`/`streamAnthropic`/`chatCompletion` 未设 temperature，用 vendor 默认 1.0，叙事场景输出飘忽，JSON 场景结构不稳定
- **修复**：streamOpenAI/streamAnthropic 叙事场景 `temperature = 0.85`（情绪摘要/分析），chatCompletion JSON 场景 `temperature = 0.6`（开放题分析）；函数签名加可选参数带默认值
- **教训**：LLM 调用必须显式设置 temperature：JSON 结构化场景 0.6-0.7（稳定优先），叙事场景 0.8-0.9（多样性优先）；不依赖 vendor 默认值（OpenAI/Anthropic/MiniMax 默认 1.0 偏高）；函数签名用 `temperature: number = 0.85` 带默认值，调用方可按需覆盖

### 5.69 订阅 out_trade_no 必须加时间戳防撞单，保留旧格式兼容已付款回调（14 维度审查 W-E-3）

- **问题**：`subm_{userId}` 格式同用户多次订阅会撞 out_trade_no 唯一约束被微信拒（cuid 24 字符 + 前缀 5 字符 = 29 字符，无时间戳）
- **修复**：新格式 `sm_{userId 24 字符}{ts base36 后 3 位}` = 30 字符 ≤ 32，46656 种组合撞单概率可忽略；`parseSubscriptionFromOutTradeNo` 同时识别新格式（slice(3, -3) 取 userId）和旧格式（slice(5) 兼容已付款订单回调）
- **教训**：out_trade_no 必须保证唯一性，同 userId 多次订阅需加时间戳/随机后缀；微信要求 6-32 字符，cuid 24 字符 + 前缀 3 字符 + 时间戳后 3 位 = 30 字符；回调反解函数必须保留旧格式兼容，避免已付款订单无法续期；时间戳用 base36 后 3 位（46656 种组合）足够区分

### 5.70 支付回调验签 fail-closed 不依赖 NODE_ENV，用显式环境变量（14 维度审查 W-S-3）

- **问题**：`verifyNotifySignature` 用 `NODE_ENV !== 'production'` 跳过验签，但开发环境也可能被外网回调攻击（如 ngrok 暴露本地服务）
- **修复**：改用显式环境变量 `WECHAT_PAY_SKIP_SIGNATURE_CHECK=1` 控制跳过（仅本地调试），默认必须验签；未配置 `WECHAT_PAY_PLATFORM_CERT_PEM` 时拒绝回调（fail-closed）
- **教训**：安全开关不能依赖 NODE_ENV（开发环境也可能暴露公网），必须用显式环境变量 + 默认 fail-closed；本地调试用 `WECHAT_PAY_SKIP_SIGNATURE_CHECK=1`，生产必须配置平台公钥；fail-closed 原则：缺配置时拒绝而非放行，避免攻击者伪造回调任意解锁

### 5.71 高频查询字段必须加单列索引，不能只依赖复合 unique 索引前缀（14 维度审查 W-D-3）

- **问题**：DailyTask 频繁按 coupleId 查询（cron 推送 `findMany({ where: { coupleId: { in } } })`、streakDays 计算 `count({ where: { coupleId } })`），缺单列索引导致全表扫描；虽有 `@@unique([coupleId, date])` 但查询规划器不一定选
- **修复**：DailyTask 加 `@@index([coupleId])`；MoodEntry 已有 `@@index([userId, date])` 覆盖 userId 前缀查询，无需新增
- **教训**：高频查询字段（外键 + 频繁 where 条件）必须加单列索引；复合 unique 索引虽可前缀扫描，但单列索引让查询规划器更稳定选择，降低 IN + 等值组合查询代价；审查时优先检查 cron 路由和列表查询的 where 字段

### 5.72 微信小程序禁止诱导分享措辞，强诱导改温和鼓励（14 维度审查 W-WC-2）

- **问题**：「分享后解锁」「转发给好友查看完整内容」「等 TA 分享解锁」等强诱导措辞违反微信《运营规范》，会被拒审或下架
- **修复**：改为温和措辞「分享给 TA 一起看」「等 TA 把结果发给你」「分享给 TA 一起看吧」；保留弱鼓励 CTA「分享给 TA」「分享到朋友圈」入口标题；技术性注释同步更新
- **教训**：微信小程序《运营规范》禁止诱导分享——禁止「分享解锁/转发查看/邀请好友」作为功能前置条件；允许温和鼓励「分享给 TA」；审查原则：强诱导（功能前置）→ 改温和措辞，弱鼓励（CTA）→ 保留；用户可见文案 + 技术性注释都要同步

### 5.73 运行时依赖必须与类型声明同步安装（V2 P0 修复）

- **问题**：`package.json` 的 `devDependencies` 有 `@types/jsonwebtoken`，但 `dependencies` 没有 `jsonwebtoken`，导致 dev server 启动后所有依赖 `lib/wechat-auth.ts` 的路由（含 `/api/track`）全部 500（Module not found），落地页埋点全线失效
- **修复**：`npm install jsonwebtoken` 加入 `dependencies`
- **教训**：`@types/X` 只装类型不装运行时，生产构建/dev server 仍会 Module not found；审查 `package.json` 时必须确认每个 `import X from 'X'` 的 X 都在 `dependencies`（不是 `devDependencies`）；TypeScript 编译通过 ≠ 运行时可用

### 5.74 配对完成必须同时创建 Couple 记录，否则每日任务功能完全瘫痪（V2 P0 修复）

- **问题**：`test/submit` B 模式事务只创建 TestSession + PairSession，全代码库 grep `prisma.couple.create` 零匹配，但 `lib/task-service.ts` 的 `getCoupleForUser` 强依赖 `Couple` 表，导致 `/api/task/today` 永远返回 404，每日任务（产品核心留存功能）完全瘫痪
- **修复**：在 `test/submit` 的 `prisma.$transaction` 中加 `tx.couple.create({ data: { pairSessionId, partnerAId: inviter.userId, partnerBId: userId, stage: 'dating', status: 'active' } })`
- **教训**：业务流程跨表事务必须覆盖所有下游依赖的表——PairSession 完成后 Couple 必须同事务创建，否则每日任务/成长报告等功能断裂；审查时 grep `prisma.X.create` 确认每个 model 都有创建入口；V2 测试 subagent 扮演真实用户走完整流程是发现这类「编译通过但功能断裂」bug 的最有效方式

### 5.75 Prisma raw SQL 列名必须与 DB 实际列名一致，未加 @map 时是 camelCase（V2 P1 修复）

- **问题**：`/api/admin/retention` 的 raw SQL 用 `user_id` / `created_at`（snake_case），但 Prisma schema 未加 `@map`，PostgreSQL 实际列名是 `userId` / `createdAt`（camelCase），导致 `column "user_id" does not exist` 500 错误
- **修复**：所有 raw SQL 中 `user_id` → `"userId"`，`created_at` → `"createdAt"`（双引号包裹避免 Postgres 大小写折叠）
- **教训**：Prisma + PostgreSQL 默认用 camelCase 列名（除非 schema 加 `@map("snake_case")`）；raw SQL 必须用实际 DB 列名，不是 Prisma schema 字段名的 snake_case 猜测；双引号包裹标识符强制大小写敏感；审查时用 `information_schema.columns` 确认实际列名

### 5.76 NEXT_PUBLIC_* 环境变量占位符必须替换，否则 SEO 元素全部输出错误域名（V2 P1 修复）

- **问题**：`.env.local` 的 `NEXT_PUBLIC_SITE_URL=https://your-domain.pages.dev`（Cloudflare Pages 默认占位符未替换），导致 canonical / og:url / JSON-LD / sitemap.xml / robots.txt 全部输出 `your-domain.pages.dev`，搜索引擎会把它当主域名收录，与真实域名形成镜像污染，canonical 失效
- **修复**：`.env.local` 改为 `NEXT_PUBLIC_SITE_URL=https://wenxin.ai`
- **教训**：所有 `NEXT_PUBLIC_*` 环境变量在部署前必须逐一确认替换占位符；SEO 元素（canonical/og:url/JSON-LD/sitemap/robots）错误域名是上线前阻塞项；dev 环境也要用正确域名，避免本地测试时 canonical 指向占位符

### 5.77 404 页面必须自定义，Next.js 默认英文 404 与品牌割裂（V2 P1 修复）

- **问题**：访问不存在的路径返回 Next.js 默认英文 404 页（`This page could not be found.`），无中文、无品牌元素、无返回首页链接，从朋友圈分享链接进来的用户若点错链接会看到与「问心 AI」品牌严重割裂的页面，直接流失
- **修复**：新建 `app/not-found.tsx`，复用落地页纸面风格（`paper-texture` + `font-serif`），中文友好提示「这一页，似乎走丢了」+ 「返回首页」CTA
- **教训**：Next.js 14 的 `app/not-found.tsx` 是自定义 404 入口；404 页面必须保持品牌一致性（风格/字体/配色）+ 提供返回首页 CTA；从外部链接进来的用户（朋友圈/分享）最容易遇到 404，是转化的最后一道兜底

### 5.78 「最受欢迎」等绝对化用语违反《广告法》第九条（V2 P1 修复）

- **问题**：年度订阅文案「相当于 ¥24.8/月，最受欢迎」中「最受欢迎」是《广告法》第九条禁止的绝对化用语（无法证实「最」的客观性）
- **修复**：改为「订阅最多」（描述事实而非主观评价）
- **教训**：《广告法》第九条禁止「国家级/最高级/最佳/最受欢迎/第一」等绝对化用语；内测/早期产品尤其不能用「最」字描述销量/受欢迎度；审查时 grep「最」字 + 人工判断是否绝对化；合规替代：「订阅最多」（事实）「多数人选择」（相对）

### 5.79 tsconfig.json exclude 必须排除参考设计目录（V3 tsc 修复）

- **问题**：根目录 `npx tsc --noEmit` 报 `lithos/src/components/Hero.tsx` 等 8 个错误，但 lithos/ 是 Prisma 模板参考源码，不属于本项目
- **根因**：tsconfig.json `exclude` 只有 `["node_modules"]`，导致 lithos/wenxin-ai-barbiecore/wenxin-ai-design/miniapp 等参考目录被 tsc 扫描
- **修复**：`"exclude": ["node_modules", "lithos", "wenxin-ai-barbiecore", "wenxin-ai-design", "miniapp"]`（miniapp 有独立 tsconfig）
- **教训**：参考设计/模板目录必须在根 tsconfig 中显式 exclude；新增参考目录时同步更新 exclude；miniapp/Taro 子项目有独立 tsconfig，不能被根 tsc 扫描

### 5.80 Node.js Buffer 不能直接作为 NextResponse BodyInit（V3 tsc 修复）

- **问题**：`app/api/qrcode/route.ts` 三处 `new NextResponse(buffer, ...)` 报 `Argument of type 'Buffer<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit'`
- **根因**：Node.js Buffer 类型与 Web fetch BodyInit 类型不兼容（Buffer 缺少 URLSearchParams 的 size/append/delete/get 等属性）
- **修复**：`new NextResponse(new Uint8Array(buffer), ...)` 包装为 Uint8Array
- **教训**：Next.js Route Handler 返回二进制时，Buffer 必须转 Uint8Array 或 ArrayBuffer；`new Uint8Array(buf)` 是最小开销转换；同理 `new Blob([buffer])` 也可但开销略高

### 5.81 Prisma JsonValue → 业务类型必须用 `as unknown as T` 双重断言（V3 tsc 修复）

- **问题**：`app/api/sessions/[id]/messages/route.ts` 的 `session?.context as UserInput` 报类型不兼容（JsonValue 与 UserInput 无重叠）
- **根因**：Prisma Json 字段类型是 `JsonValue`（递归联合类型），直接 `as UserInput` TS 认为不安全
- **修复**：`session?.context as unknown as UserInput`（双重断言）
- **教训**：Prisma Json 字段反序列化为业务类型时统一用 `as unknown as T`；同理 `subscription/notify/route.ts` 的 `decryptPayNotifyResource(...) as PayResult` 也需双重断言；单重 as 在 JsonValue/Record<string,unknown> → 具体接口场景必报 TS2352

### 5.82 Prisma nullable 字段 null 与业务类型 undefined 不兼容（V3 tsc 修复）

- **问题**：`app/api/task/[taskId]/summary/route.ts` 的 responseA（Prisma TaskResponse，emotionTag: string | null）传给 buildTaskSummaryPrompt（参数 TaskResponseInfo，emotionTag?: string 即 string | undefined）报 TS2345
- **根因**：Prisma schema 未加 `?` 的可选字段默认 `string | null`，但业务 interface 用 `?:` 是 `string | undefined`，null 与 undefined 不兼容
- **修复**：`responseA as unknown as TaskResponseInfo` 双重断言
- **教训**：Prisma 模型与业务 interface 的 null/undefined 语义差异是高频 TS 错误源；统一策略：调用处用 `as unknown as T` 双重断言，或构造时 `field: r.field ?? undefined` 把 null 转 undefined；不要改 Prisma schema 的 nullability 来迁就 TS

### 5.83 未引用的模板残留组件必须删除（V3 tsc 修复）

- **问题**：`components/animations/`（复数，7 文件 Aurora/BlurText/CountUp/Magnet/ParticleTrail）报 TS 错误，但项目实际用的是 `components/animation/`（单数，3 文件 WordsPullUp/WordsPullUpMultiStyle/AnimatedLetter）
- **根因**：从 lithos 模板复制动画组件时残留了未使用的旧版本，未被任何代码 import（只 CODE_WIKI.md 文档提到）
- **修复**：删除整个 `components/animations/` 目录
- **教训**：从模板/参考项目复制组件后必须清理未引用的残留；用 `grep -r "components/animations/X"` 验证引用，零代码引用（仅文档）即可删除；残留组件不仅是代码噪音，还会引入 tsc 误报

### 5.84 V3 素材替换：外部资源换 AI 生成 + lucide-react 图标（V3 优化）

- **问题**：V3 首页 Hero/Features 背景用外部视频 URL（依赖第三方资源 + 加载慢），Features 卡片图标用远程 PNG（不可控 + HTTP 请求多）
- **修复**：Hero/Features 背景换为 `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=...&image_size=landscape_16_9`（AI 生成深色关系主题图），Features 图标换为 lucide-react 的 Heart/CalendarCheck/TrendingUp（放在 bg-[#101010] 圆角容器中）
- **教训**：落地页素材优先用 AI 生成图（可控 + 不依赖外部资源 + 一次生成可缓存）；图标统一用 lucide-react（tree-shaking + SVG + 一致风格），不用远程 PNG；视频背景在移动端加载慢，深色静态图 + 噪点叠加也能达到电影感

### 5.85 小程序 V3 同步：scss 颜色翻转 + 数据可视化组件保留原色（V3 优化）

- **问题**：Web 端切 V3 深色后，小程序 16 个 scss 文件仍是 V2 浅色（#FAFAFA/#FFFFFF/#E8657E），体验割裂
- **修复**：颜色映射翻转 `#FAFAFA→#000000`、`#FFFFFF→#101010`、`#F5F5F5→#212121`、`#2A2A2A→#E1E0CC`、`#E8657E（问心粉）→#DEDBC8（cream）`；但 RadarChart SVG 硬编码色（#E8657E/#4A90E2）和 ShareCanvas 分享图背景保留原色
- **教训**：小程序与 Web 端视觉同步时，scss 变量化（$primary/$paper/$ink/$border）便于全局翻转；数据可视化组件（RadarChart）的硬编码色保留，因为图表配色独立于品牌色系；对外分享图（ShareCanvas）背景保留白，因为分享到微信好友/朋友圈时白底辨识度更高

### 5.86 lucide-react 1.x 版本可用，核心图标导出正常（V3 优化）

- **问题**：package.json 写 `"lucide-react": "^1.23.0"`，但 lucide-react 历史版本号是 0.x.x，担心 1.x 是错误版本
- **验证**：`node -e "const l = require('lucide-react'); ['ArrowRight','Check','Heart','CalendarCheck','TrendingUp'].forEach(n => console.log(n, typeof l[n]))"` 全部输出 `object`（ForwardRefExoticComponent）
- **教训**：lucide-react 1.x 是新版本线（非伪造）；图标导入前用 node REPL 验证导出存在；lucide-react 用 ForwardRefExoticComponent，typeof 是 'object' 非 'function'；5 个核心图标（ArrowRight/Check/Heart/CalendarCheck/TrendingUp）在 1.23.0 全部可用

---

## 六、关键决策记录

| 决策 | 选择 | 理由 | 拒绝方案 |
|------|------|------|---------|
| 题库 | 男女各 30 题独立 | 男女角色不同，一套题失真 | 共用一套 |
| 配对机制 | 必须双方都答题 | 类型是双方关系不是单人画像 | A 答完即出类型 |
| 结果查看 | A 必须等 B 分享 | 强制双边参与 + 避免多人混淆 | 双方都能直接看 |
| 同性恋类型 | 男男 15 + 女女 15 专属 | 扩充覆盖更多模式，isPublic=false | 共用一套类型 |
| 命名风格 | 三段式意象化（去角色标签） | 表达关系动态，避免伦理不适 | MBTI 字母 / 父与子等角色标签 |
| 开放题 | 每对 couple 随机抽 1 + 3 约束 | 防作弊 + 横向可比 + 类型稳定 | 固定题目 / 完全随机 |
| 流式输出 | MVP 一次性返回 | 快速上线 | WebSocket（V2 再做） |
| 认证 | 微信登录 + JWT | 小程序原生体验 | NextAuth 邮箱 |

---

## 七、审查清单（每个原子点完成后过一遍）

- [ ] security：无 SQL 注入、XSS、敏感信息泄漏
- [ ] performance：API 响应 <500ms、无 N+1 查询
- [ ] typescript：无 any、无 implicit any
- [ ] ux：加载态、错误态、空态都有处理
- [ ] edge-case：列出 5 个边缘情况并处理
- [ ] wechat-compliance：不违反小程序审核规则
- [ ] regression：不破坏已完成原子点

---

## 八、当前进度

**Phase 0 基础设施** 进行中（已完成 Review + 修复循环）
- [x] 0.1.1-0.1.5 Prisma schema 扩展（User + TestSession + PairSession + CoupleType + Couple + DailyTask + TaskResponse）
- [x] 0.1.5+ Schema 审查修复（Cascade→Restrict + 删冗余索引 + 补 onDelete + 时区 + bankVersion + A 邀请多人约束）
- [x] 0.4.1 shared/types.ts 核心类型定义（含 AnswersPayload）
- [x] 0.4.2 shared/test-bank-male.ts 男生 29 题（评分对称性已校准）
- [x] 0.4.3 shared/test-bank-female.ts 女生 29 题（评分对称性已校准）
- [x] 0.4.4 shared/open-questions.ts 开放题库 10 道 + pickOpenQuestion(preferId) + pickOpenQuestionForNewCouple
- [x] 0.4.5 shared/scoring.ts 评分引擎（calculateDimensionScores + calculateCompatibility）
- [x] CLAUDE.md 知识固化机制（含 15 条已踩过的坑）
- [x] 三份文档一致性修复（TECH_PLAN/TEST_QUESTIONS/COUPLE_TYPES）
- [x] 三轮循环验证（0 阻塞 / 0 警告 / 0 次要问题）
- [x] 0.1.6 65 种 CoupleType seed 数据（hetero 35 + male-male 15 + female-female 15）
- [x] 0.2 微信登录（lib/wechat-auth.ts + app/api/auth/wechat/login + app/api/auth/me）
- [x] 0.3 Taro 小程序脚手架（5 原子点全部完成）
  - [x] 0.3.1 脚手架初始化（package/tsconfig/babel/project.config/config/）
  - [x] 0.3.2 全局配置（app.config.ts/app.tsx/app.scss）
  - [x] 0.3.3 6 个页面（index/test/invite/result/tasks/profile）+ 6 个 config + 6 个 scss
  - [x] 0.3.4 请求封装（lib/request.ts）+ 登录管理（lib/auth.ts）
  - [x] 0.3.5 分享与扫码（lib/share.ts + app.tsx 扫码进入处理）
- [x] 0.3 审查循环 3 轮收敛（10 阻塞 + 3 警告 → 0 阻塞 0 警告）

**Phase 0 已完成**。

- [x] Phase 1：男女分离题库+答题（18 原子点）
  - [x] 1.1 题库与计分（5 点，Phase 0 已完成）
  - [x] 1.2 测试 API（4 点）：/api/test/start、/api/test/submit（事务+前置校验）、/api/test/session/[id]、lib/open-question-analyzer.ts
  - [x] 1.3 小程序答题页（6 点）：test 页已含性别选择+答题+开放题+提交（intro/submit 合并不拆分）、雷达图组件 RadarChart
  - [x] 1.4 性别与代词（3 点）：shared/gender-combo.ts、shared/pronoun.ts（含「他们/她们」豁免）、profile 页性别编辑入口
- [x] Phase 1 审查循环 2 轮收敛（1 阻塞 + 6 警告 → 0 阻塞 0 警告）

**Phase 1 已完成**。

- [x] Phase 2：双方配对机制（核心，24 原子点）
  - [x] 2.1 配对 API（8 点）：init / join / result / share / status / mine / unlock + lib/pair-result.ts（Phase 1 submit 已涵盖 complete/initiator-complete）
  - [x] 2.2 A 首页状态动态化（3 点）：调 /api/pair/mine 按 resultSharedToInitiator 区分文案
  - [x] 2.3 邀请分享（3 点）：lib/share.ts 已含分享卡片 + 邀请链接 + B 扫码路径选择页（pages/invite/join）
  - [x] 2.4 解锁支付/广告（4 点）：/api/pair/unlock + lib/wechat-pay.ts + /api/pair/pay + /api/wechat/pay/notify + lib/ad.ts 激励视频
  - [x] 2.5 边缘情况（6 点）：A 邀请多人 @unique 防护、B 完成未分享、双方性别相同同性专属类型徽章、30 天重测/矛盾检测（Phase 3 完善）
- [x] Phase 2 审查循环 2 轮收敛（2 阻塞 + 5 警告 → 1 阻塞 → 0 阻塞 0 警告）

- [x] Phase 3：类型匹配 + 结果分享（19 原子点）
  - [x] 3.1 类型匹配算法（6 点）：classify-attachment / classify-conflict / classify-stage / type-matcher（三元组精确匹配 + 相似度回退）+ submit 路由集成 + pair-result.ts 移除占位
  - [x] 3.2 结果展示（4 点）：result 页双方头像 + 雷达图双方对比 + 类型详情页 + 类型百科页（仅 isPublic）
  - [x] 3.3 结果分享（5 点）：ShareEvent 表 + 4 种卡片变体（boast/selfmock/helpseek/mystery）+ /api/pair/track utm 追踪 + ShareCanvas Canvas 绘制朋友圈图片 + result 页集成
  - [x] 3.4 同性隐私保护（4 点）：百科页只 import hetero 类型 + 分享标题不暴露同性类型名 + 详情页 !isPublic 限制访问 + result 页「专属类型」标签仅 paid 后显示
- [x] Phase 3 审查循环（7 阻塞 + 12 警告 + 13 建议 → 修复 7 阻塞 + 7 关键警告 → 二轮 tsc 验证通过）
- [x] Phase 3 经验固化（5.28-5.38 共 11 条新经验）

**Phase 3 复审**（第二轮）：系统审查 19 原子点代码，发现 2 阻塞 + 4 警告 + 7 建议
- [x] 修复 B-1：ShareCanvas drawMultiLineText 逻辑断裂（第二行永不绘制）
- [x] 修复 B-2：微信支付回调生产环境 fail-closed（移除临时放行）
- [x] 修复 W-1：同性隐私 Canvas 全面屏蔽（emoji/oneLiner/雷达图）
- [x] 修复 W-2：pickShareVariant helpseek 触发条件改用 compatibility 区间
- [x] 修复 W-3：boast 占比计算区分同性/异性单位
- [x] 修复 W-4：share/route.ts 并发首次分享用 updateMany + where
- [x] Phase 3 复审经验固化（5.39-5.44 共 6 条新经验）
- [x] 根目录 + miniapp tsc 验证通过

**Phase 3 已完成（含复审）**。下一步进入 Phase 4：每日任务（20 原子点）。

- [x] Phase 4：每日任务（20 原子点）
  - [x] 4.1 任务生成（5 点）：lib/task-generator.ts 7 维权重框架（weakness 0.3 / emotionTrend 0.2 / 其余各 0.1，实际 4 维生效 3 维预留）+ fallback 库 + lib/task-service.ts 共用服务层（getTodayDateInTimezone / buildDailyTaskInfo / getCoupleForUser / getUserRoleInCouple / parseJsonFromLlm）+ /api/task/today + /api/task/[taskId]
  - [x] 4.2 小程序任务页（4 点）：tasks 列表页（任务卡片+维度标签+状态徽章+默契度横幅）+ task/detail 详情页 + task/chat 写感受+拍照上传页 + tasks/index.scss 适配
  - [x] 4.3 任务回应与总结（5 点）：/api/task/[taskId]/response（LLM 情绪命名 + 状态更新）+ /api/task/[taskId]/summary（LLM 默契度分析 + 双方推送）+ shared/types TaskSummaryResult + lib/prompts buildTaskSummaryPrompt + buildEmotionNamingPrompt
  - [x] 4.4 文件上传（3 点）：/api/upload multipart 上传（jpeg/png/webp/gif 5MB 限）+ JWT 鉴权 + UPLOAD_BASE_URL CDN 切换 + miniapp task/chat 集成
  - [x] 4.5 订阅消息推送（3 点）：lib/wechat-mp.ts（access_token 进程内缓存 7000s + 40001/42001 重试 + 5s 超时）+ /api/push/subscribe upsert 配额管理 + /api/push/cron CRON_SECRET 鉴权 + chunk 10 并发 + lib/push-service.ts fire-and-forget 双发
- [x] Phase 4 多维度审查循环（1 阻塞 + 9 警告 + 12 建议 → 修复 1 阻塞 + 5 关键警告 W-1/W-2/W-3/W-6/W-7）
  - [x] 修复 B-1：tasks 页渲染裸 JSON（aiSummary 改引导文案）
  - [x] 修复 W-1：TaskResponse 加 @@unique([taskId, userId]) + 捕获 P2002
  - [x] 修复 W-2：summary 路由用 updateMany + where: { aiSummary: null } 抢占首次写入权
  - [x] 修复 W-3：cron 推送按 sub.userId 映射本人角色判断 userDone
  - [x] 修复 W-6：cron 串行 100 条改 chunk 10 并发 + Promise.allSettled
  - [x] 修复 W-7：access_token 40001/42001 清缓存重试一次 + fetch 5s 超时
  - [x] 未处理警告（非阻塞）：W-4 fallback 缺 hard 难度 / W-5 cron N+1 查询 / W-8 时区硬编码 Asia/Shanghai / W-9 LLM 撞 unique 时被丢弃
  - [x] 未处理建议 S-1~S-12（非阻塞，可选优化）
- [x] Phase 4 经验固化（5.45-5.50 共 6 条新经验）
- [x] 根目录 + miniapp tsc 验证通过

**Phase 4 已完成（含审查循环 + 经验固化）**。下一步进入 Phase 5：成长报告与付费（16 原子点）。

### Phase 5：成长报告与付费（16 原子点）

- [x] 5.1 报告聚合（4 点）：lib/report.ts aggregateReport（7d/30d 任务完成率 + 默契度趋势 + 连续打卡 + 6 维度变化基于 TestSession 对比）+ DIMENSION_LABELS_FOR_REPORT + generateReportId + safeDimensionScores 安全转换 Prisma Json
- [x] 5.2 报告 API（3 点）：/api/report/[coupleId] 免费/付费分层返回（免费版仅 aggregation + 兜底 title/blessing，订阅版 LLM 叙事缓存在 Couple.profile.reports 保留最近 10 份）+ /api/report/share 分享卡片（记录 ShareEvent utm_source='report_card'）
- [x] 5.3 订阅系统（5 点）：lib/subscription.ts SUBSCRIPTION_PRODUCTS（¥39/月 ¥298/年）+ parseSubscriptionInfo 安全转换 + getUserSubscription 过期修正写回 + activateSubscription 续费叠加 + /api/subscription/create 下单写 pendingOrder + /api/subscription/notify 验签+解密+反解+金额校验+pendingOrder 校验+激活+清 pendingOrder（幂等）+ /api/subscription/status 状态查询 + miniapp 订阅管理页（套餐选择 + wx.requestPayment + mock 模式）
- [x] 5.4 危机用户保护（4 点）：lib/crisis-detector.ts detectCrisis 三档等级（high 26 关键词 / middle 20 关键词 / low）+ CRISIS_BOUNDARY_PROMPT middle 级别叠加 + HIGH_RISK_RESPONSE high 级别固定话术不调 LLM + /api/task/[taskId]/response 集成危机检测（high 不调 LLM / middle 叠加边界 Prompt）+ miniapp/pages/crisis 资源页（4 条热线 + 110/120 紧急）+ task/chat 提交后 high 级别 Taro.redirectTo 自动跳转资源页
- [x] Phase 5 多维度审查循环（1 阻塞 + 4 警告 + 5 建议 → 修复 1 阻塞 + 4 警告）
  - [x] 修复 B-1：订阅页文案「自动扣费」与实际「一次性购买」不符，改为「到期后需手动续费，不会自动扣款」（违反消费者权益保护法）
  - [x] 修复 W-1：删除 handleCancel 死代码（B-1 修复时遗留的未引用函数）
  - [x] 修复 W-2：crisis/index.tsx 与 crisis-detector.ts 热线数据重复，加注释说明镜像副本关系
  - [x] 修复 W-6：notify/route.ts 金额错误消息硬编码改为 SUBSCRIPTION_PRODUCTS[plan].amountFen
  - [x] 修复 S-4：subscription/index.tsx 顶部注释「取消订阅」与实际逻辑不符，更新为「一次性购买」说明
  - [x] 未处理警告（非阻塞）：W-3 HIGH_RISK_RESPONSE 与危机页热线两处维护 / W-4 pendingOrder:undefined 实际工作正常 / W-5 notify 第二次 update 冗余但防御性 / W-7 危机页无认证（纯静态可接受）/ W-8 30d 报告缺 Cache-Control（V2 优化）/ W-9 关键词误判（宁可信其有策略可接受）
  - [x] 未处理建议 S-1~S-5（非阻塞，可选优化）
- [x] Phase 5 经验固化（5.51-5.56 共 6 条新经验）
- [x] 根目录 + miniapp tsc 验证通过

**Phase 5 已完成（含审查循环 + 经验固化）**。下一步进入 Phase 6：Web 官网改造。

### Phase 6：Web 官网改造（8 原子点）

- [x] 6.1 app/page.tsx 落地页改造：移除 EmotionForm + ResultDisplay 单次报告流程，改为订阅制（¥39/月 ¥298/年）+ 扫码进小程序 CTA + 极简纸面风格 + 创始人的话 + FAQ（5 条）+ 移动端优先（max-w-2xl 响应式）
- [x] 6.2 小程序码生成：lib/wechat-mp.ts 扩展 getMiniProgramQRCode（wxacode.getUnlimited + 40001/42001 重试 + 8s 超时）+ getMiniProgramQRCodeWithCache（1h 内存缓存 Map<scene::page>）+ /api/qrcode 路由（scene/page 校验 + SVG 占位降级 + Cache-Control 1h/60s）
- [x] 6.3 SEO 优化：app/sitemap.ts（仅暴露 /）+ app/robots.ts（allow / disallow /api/ /auth/ /chat/ /admin/）+ app/layout.tsx 完整 metadata（title template / openGraph / twitter / alternates canonical）+ JSON-LD（WebSite + Product 含两个 Offer）+ metadataBase
- [x] 6.4 部署文档：DEPLOY.md 完整重写（部署架构 + 环境变量清单 + 构建配置 Node 20.x + 部署后验证清单 + miniapp 独立部署流程 + 常见问题 Q&A + 成本预估）
- [x] 6.5 旧路由归档：next.config.js redirects() 5 条 301 永久重定向（/auth/* /chat/* /api/summary /api/analyze /api/sessions/* → /）
- [x] 6.6 小程序埋点 SDK：prisma schema 新增 TrackEvent 模型（事件名/属性/source/索引）+ miniapp/src/lib/track.ts（fire-and-forget + sanitizeProps + 11 个语义化快捷方法）+ /api/track 后端（可选鉴权 + 事件名正则 + 字符串截断 256 + 批量 createMany ≤20 条）+ 4 个页面接入（index/tasks/task/chat/subscription）
- [x] 6.7 转化漏斗看板：lib/admin-auth.ts（fail-closed + timingSafeEqual）+ /api/admin/funnel（6 步漏斗 landing_visit/test_start/test_complete/pair_join/task_complete/subscribe_success + prisma.groupBy 聚合 + 步转化率/整体转化率）+ app/admin/dashboard 服务端渲染
- [x] 6.8 留存曲线看板：/api/admin/retention（raw SQL cohort 查询 + 活跃日集合 + Node 层双重循环计算留存率）+ dashboard 渲染 Day 0/1/3/7/14/30 卡片
- [x] Phase 6 多维度审查循环（2 阻塞 + 2 重要警告 + 6 非阻塞建议 → 修复 2 阻塞 + 2 警告）
  - [x] 修复 B-1：落地页虚构数据「5,237+ 对情侣服务 · 平均默契度提升 23%」违反广告法，改为「内测中 · 每一对反馈都在让产品变得更好」（5.63）
  - [x] 修复 B-2：lib/admin-auth.ts 用 `===` 比较 token 存在时序攻击风险，改用 `crypto.timingSafeEqual` 常数时间比较（5.61）
  - [x] 修复 W-1：DEPLOY.md LLM 配置写 DeepSeek 与 .env.local.example 写 MiniMax 不一致，对齐为 MiniMax-M3 默认 + 可切换 DeepSeek/Kimi/GLM/Qwen
  - [x] 修复 W-2：/api/admin/funnel landing_visit 复用 page_view 与小程序首页重复计数，落地页加 SSR beacon 上报独立 landing_visit 事件（fetch keepalive）+ funnel API 改用 landing_visit 聚合（5.64）
  - [x] 未处理警告（非阻塞，V2 优化）：W-3 留存双重循环性能 / W-4 dashboard 服务端自调用 fetch / W-5 TrackEvent source 硬编码 / W-6 TrackEvent 无 TTL / W-7 retention userIds 数组上限 / W-8 next.config.js 可能遗漏原有配置
  - [x] 未处理建议 S-1~S-2（非阻塞，V2 优化：dashboard 重复接口定义提取 shared types / retention 分批查询）
- [x] Phase 6 经验固化（5.57-5.64 共 8 条新经验）
- [x] 根目录 + miniapp tsc 验证通过（exit 0；lithos 为独立 Vite 子项目，与 Phase 6 无关）

**Phase 6 已完成（含审查循环 + 经验固化）**。8 个原子点全部交付，2 阻塞 + 2 警告已修复，6 非阻塞 V2 优化项已记录。

---

### 14. 并行审核 Agent 矩阵（TECH_PLAN.md L743-L762）

5 个 subagent 并行执行 14 维度审查（security / performance / architecture / typescript / api-contract / db / ux / edge-case / prompt-quality / wechat-compliance / psychology / shareability / regression / doc），覆盖全项目 120 原子点交叉审查。

- [x] 14 维度并行审核执行（5 subagent × 2-3 维度）
- [x] 真实阻塞识别（去重后 10 项）+ 用户决策
  - B-WC-1 虚拟支付合规 → 用户决策「暂时移除解锁功能」（MVP 深度内容免费开放）
  - 其他 9 项 → 用户决策「全部立即修复」
- [x] 18 项修复全部交付（f1-f18）
  - [x] f1 B-WC-1 移除解锁功能（删 2 文件 + 改 7 文件）
  - [x] f2 B-S-1 admin dashboard 客户端组件 + token 输入
  - [x] f3 B-U-2/B-E-1 开放题接入 detectCrisis + 前端跳资源页
  - [x] f4 B-P-1 cron 推送 N+1 改 findMany 批量查询（200 次 → 2 次）
  - [x] f5 B-U-1 首页加 loading 态 + 重试按钮
  - [x] f6 B-PQ-1 LLM 调用加 temperature（叙事 0.85 / JSON 0.6）
  - [x] f7 B-PQ-2 开放题 attachment 加 F 混乱型 + 枚举约束
  - [x] f8 B-PS-1 重写 classify-conflict 对齐 EFT 理论
  - [x] f9 B-DOC-1 重写 README.md
  - [x] f10 W-WC-3 estimatedRatio 三组归一化到 100%
  - [x] f11 W-E-3 订阅 out_trade_no 加时间戳防撞单
  - [x] f12 W-S-3 wechat-pay 验签 fail-closed 不依赖 NODE_ENV
  - [x] f13 W-S-5 CRON_SECRET 改 timingSafeEqual
  - [x] f14 W-PQ-1 情绪命名 LLM 失败加 fallback
  - [x] f15 W-PS-7 危机关键词加他伤信号
  - [x] f16 W-D-3 DailyTask 加 coupleId 索引
  - [x] f17 W-SH-1 ShareCanvas 绘制小程序码
  - [x] f18 W-WC-2 移除诱导分享措辞（11 处文案改温和）
- [x] 经验固化（5.65-5.72 共 8 条新经验）
- [x] 根目录 + miniapp tsc 验证通过（exit 0）

**14 维度并行审核矩阵已完成**。10 真实阻塞 + 8 警告全部修复，3 subagent 并行 + 主线程协同交付，18 项修复零回归。项目可进入 V2 优化或上线部署阶段。

---

### 15. V2 优化 + 用户回归测试（Phase 4/6 遗留 + P0/P1 修复）

5 subagent 并行执行 V2 优化（Phase 4/6 遗留非阻塞项）+ 3 subagent 扮演真实目标用户走完整流程，发现 2 个 P0 阻塞 + 6 个 P1 问题，全部修复后端到端跑通。

- [x] V2 优化组 A（Phase 4 遗留）：W-4 fallback hard 难度 / W-8 时区 env 化 / W-9 LLM 撞 unique 预检查 + S-1/S-2/S-3 建议（7 文件）
- [x] V2 优化组 B（Phase 6 遗留）：W-3 留存循环优化 / W-4 dashboard 自调用确认已修 / W-5 TrackEvent source 动态识别 / W-6 TrackEvent TTL 注释 / W-7 retention userIds 上限 / W-8 next.config 审查注释 + S-1 shared/admin-types.ts / S-2 retention 分批查询（7 文件）
- [x] 用户测试 subagent A（Web 落地页）：发现 jsonwebtoken 缺失 + NEXT_PUBLIC_SITE_URL 占位符 + 404 英文页 + 「最受欢迎」文案
- [x] 用户测试 subagent B（API 流程）：发现 jsonwebtoken 缺失 + Couple 表从不创建 + alternatives 未返回 + 任务/分享流程验证
- [x] 用户测试 subagent C（Admin 看板）：发现 jsonwebtoken 缺失 + ADMIN_TOKEN 未配置
- [x] P0 修复：jsonwebtoken 依赖安装 + Couple 表在 test/submit 事务中创建
- [x] P1 修复：NEXT_PUBLIC_SITE_URL=wenxin.ai + ADMIN_TOKEN 配置 + LLM_MODEL=deepseek-chat + 404 页面 + 「最受欢迎」→「订阅最多」+ retention raw SQL 列名修复
- [x] 回归测试 subagent：完整 API 流程（答题→配对→每日任务→结果分享→Admin 看板）端到端跑通，Couple 表创建验证通过，每日任务从 404 变 200
- [x] 经验固化（5.73-5.78 共 6 条新经验）
- [x] 根目录 + miniapp tsc 验证通过（exit 0）

**V2 优化 + 用户回归测试已完成**。Phase 4/6 遗留非阻塞项全部处理，2 P0 + 7 P1 修复零回归，完整用户流程端到端跑通。项目可进入上线部署阶段。

---

### 16. V3 视觉系统重设计（Prisma 深色电影感）

参考 Prisma 创意工作室模板，把问心 AI 视觉从 V2 浅色（paper #FAF8F5 + Fraunces serif）全面翻转到 V3 深色电影感（black + cream #DEDBC8 + Almarai + Instrument Serif italic）。3 个动画组件 + 6 个页面同步。

- [x] 配置层：tailwind.config.ts（primary #DEDBC8 + serif Instrument Serif）+ globals.css（深色基底 + .noise-overlay/.bg-noise SVG 噪点 + Almarai 全局字体）
- [x] 动画组件：components/animation/WordsPullUp.tsx + WordsPullUpMultiStyle.tsx + AnimatedLetter.tsx（framer-motion useInView + useScroll 滚动联动）
- [x] 设计规范：docs/DESIGN_SYSTEM.md（9 章节，色彩/字体/布局/动效/响应式/迁移指南）
- [x] 首页重写：app/page.tsx 三段式（Hero 视频背景 + 巨字「问心」+ About 滚动逐字揭示 + Features 4 卡片 staggered 入场）
- [x] 同步页面：not-found（深色 404）+ admin/dashboard（深色 token 输入 + 看板）+ auth/signin + auth/verify
- [x] tsc 双端 exit 0 + dev server 视觉验证通过

**V3 视觉系统重设计已完成**。6 个页面全部切到深色电影感，3 个动画组件复用，设计规范文档固化。

---

### 17. V3 优化（素材替换 + 小程序同步 + tsc 修复）

V3 视觉系统落地后的收尾优化：把外部资源换为可控素材、小程序端同步深色、修复 tsc 预存错误。

- [x] 素材替换（app/page.tsx）：Hero/Features 背景从外部视频 URL 换为 AI 生成深色关系主题图（text_to_image API）；Features 卡片图标从远程 PNG 换为 lucide-react（Heart/CalendarCheck/TrendingUp）放在 bg-[#101010] 圆角容器
- [x] 小程序端 V3 同步：16 个 scss 文件颜色翻转（#FAFAFA→#000000 / #FFFFFF→#101010 / #F5F5F5→#212121 / #2A2A2A→#E1E0CC / #E8657E→#DEDBC8）；RadarChart SVG 硬编码色 + ShareCanvas 分享图背景保留原色
- [x] tsc 修复（9 处预存错误）：tsconfig.json exclude 排除 lithos/wenxin-ai-* / miniapp；qrcode Buffer→Uint8Array；Prisma JsonValue→`as unknown as T` 双重断言（sessions/messages + subscription/notify）；Prisma null→undefined 双重断言（task/summary）；ChatBubble timestamp Date→string；wechat-mp retry 补 contentType；删除 components/animations/ 模板残留 7 文件
- [x] 视觉走查（curl SSR 验证）：首页「问心」27 次 + AI 图 4 处 + lucide SVG 17 个 + ¥39/¥298 定价 + 三层深色背景 + 噪点纹理；404 深色 + btn-editor；Admin gate 视图深色
- [x] tsc 双端 exit 0（根目录 + miniapp 零错误）
- [x] 经验固化（5.79-5.86 共 8 条新经验）

**V3 优化已完成**。素材全部可控（AI 生成图 + lucide-react），小程序与 Web 端视觉统一，tsc 零错误。项目可进入上线部署阶段。
