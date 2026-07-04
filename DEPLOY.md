# EdgeOne Pages 部署指南（Phase 6.4）

> 问心 AI 官网 + 小程序后端统一部署到腾讯云 EdgeOne Pages

---

## 部署架构

- **Web 官网**：Next.js App Router SSR（落地页 + SEO）
- **小程序后端**：同站 Next.js API Routes（认证 + 业务 + 微信支付回调）
- **小程序前端**：独立打包为微信小程序（miniapp/，不部署到 EdgeOne）
- **数据库**：Neon Postgres（Prisma ORM）
- **存储**：第三方图床（UPLOAD_BASE_URL 配置）

---

## 部署前准备

1. 代码已推送 GitHub：https://github.com/StarlitSKy88/ai-emotion-reader
2. Neon 数据库已创建，DATABASE_URL 可用
3. 微信小程序后台已开通 + AppID/Secret 已申请
4. 微信支付商户号已开通 + 证书已下载

---

## 部署步骤

### 1. 创建 EdgeOne Pages 项目

访问 https://console.cloud.tencent.com/edgeone/pages → 「+ 新建项目」→ 「导入 Git 仓库」

- 仓库：`StarlitSKy88/ai-emotion-reader`
- 分支：`main`
- 框架预设：Next.js

### 2. 构建配置

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `.next` |
| 安装命令 | `npm install` |
| Node 版本 | 20.x |

### 3. 环境变量（必填）

#### 3.1 LLM

| 变量名 | 说明 |
|--------|------|
| `LLM_PROVIDER` | `minimax`（默认，OpenAI 兼容可切换） |
| `LLM_API_KEY` | LLM API Key |
| `LLM_BASE_URL` | `https://api.minimaxi.com/v1`（默认 MiniMax，可切换 DeepSeek/Kimi/GLM/Qwen） |
| `LLM_MODEL` | `MiniMax-M3`（默认） |

#### 3.2 数据库

| 变量名 | 说明 |
|--------|------|
| `DATABASE_URL` | Neon Postgres 连接串 |
| `JWT_SECRET` | 自定义 JWT 签名密钥（≥32 字符随机串） |

#### 3.3 微信小程序

| 变量名 | 说明 |
|--------|------|
| `WECHAT_MINIAPP_APPID` | 小程序 AppID |
| `WECHAT_MINIAPP_SECRET` | 小程序 AppSecret |
| `WECHAT_TMPL_DAILY_TASK` | 每日任务提醒订阅消息模板 ID |
| `WECHAT_TMPL_TASK_SUMMARY` | 任务总结订阅消息模板 ID |

#### 3.4 微信支付

| 变量名 | 说明 |
|--------|------|
| `WECHAT_PAY_APPID` | 小程序 AppID（与上面相同） |
| `WECHAT_PAY_MCHID` | 商户号 |
| `WECHAT_PAY_API_KEY` | V3 API 密钥（32 字符） |
| `WECHAT_PAY_SERIAL_NO` | 商户证书序列号 |
| `WECHAT_PAY_PRIVATE_KEY` | 商户私钥 PEM（多行用 `\n` 转义） |
| `WECHAT_PAY_PLATFORM_CERT_PEM` | 微信平台公钥 PEM（用于回调验签，生产必填） |
| `WECHAT_PAY_NOTIFY_URL` | 解锁回调 URL（如 `https://your-domain/api/wechat/pay/notify`） |
| `WECHAT_PAY_SUBSCRIPTION_NOTIFY_URL` | 订阅回调 URL（如 `https://your-domain/api/subscription/notify`） |

#### 3.5 站点（Phase 6.3 SEO）

| 变量名 | 说明 |
|--------|------|
| `NEXT_PUBLIC_SITE_URL` | 站点完整 URL（如 `https://wenxin.ai`，用于 sitemap/SEO） |
| `NEXT_PUBLIC_SITE_NAME` | `问心 AI` |
| `NEXT_PUBLIC_WECHAT_MINIAPP_ID` | 小程序原始 ID（如 `gh_wenxin_ai`，用于落地页搜索引导） |
| `UPLOAD_BASE_URL` | 图片上传后的访问域名前缀 |

#### 3.6 定时任务

| 变量名 | 说明 |
|--------|------|
| `CRON_SECRET` | Cron 鉴权密钥（自定义 32+ 字符随机串） |

### 4. 部署

点击「开始部署」，约 2-3 分钟完成。

### 5. 绑定自定义域名（可选）

EdgeOne Pages 默认提供 `xxx.pages.dev` 域名，建议绑定备案域名：

- 在 EdgeOne 控制台 → 项目 → 「域名」→ 「添加域名」
- 修改 `NEXT_PUBLIC_SITE_URL` 为绑定后的域名
- 修改微信支付回调 URL 为新域名

---

## 部署后验证

打开部署地址，验证：

### 5.1 官网落地页（Phase 6.1）

- [ ] `/` 加载正常，纸面风格 + 订阅定价（¥39/月 ¥298/年）
- [ ] 小程序码图片加载（`/api/qrcode`，缺微信环境变量时显示 SVG 占位）
- [ ] `/sitemap.xml` 返回 sitemap
- [ ] `/robots.txt` 返回 robots 配置
- [ ] 源码含 JSON-LD 结构化数据
- [ ] 移动端响应正常

### 5.2 旧路由归档（Phase 6.5）

- [ ] `/auth/signin` 301 跳转到 `/`
- [ ] `/chat/xxx` 301 跳转到 `/`
- [ ] `/api/summary` 301 跳转到 `/`
- [ ] `/api/sessions/xxx` 301 跳转到 `/`

### 5.3 API 健康检查

- [ ] `GET /api/qrcode` 返回 PNG 或 SVG
- [ ] `GET /api/subscription/status` 未登录返回 401
- [ ] `GET /api/report/xxx` 未登录返回 401

---

## 小程序前端部署（独立流程）

miniapp/ 不部署到 EdgeOne，单独打包上传到微信小程序后台：

```bash
cd miniapp
npm install
npm run build:weapp   # 生成 dist/
```

然后用微信开发者工具打开 `miniapp/` 目录，点击「上传」→ 在小程序后台提交审核。

---

## 后续更新

```bash
git add .
git commit -m "feat: xxx"
git push
```

EdgeOne Pages 会自动检测 GitHub 推送并部署新版本。

---

## 常见问题

### Q1：部署失败 Build failed
检查环境变量是否完整（特别是 `DATABASE_URL` / `LLM_API_KEY`），EdgeOne 日志会显示具体错误。

### Q2：小程序码 API 返回 SVG 占位
缺少 `WECHAT_MINIAPP_APPID` 或 `WECHAT_MINIAPP_SECRET`；或小程序 page 路径未发布（trial 模式可生成，release 需正式版本）。

### Q3：微信支付回调失败
- 生产环境必须配置 `WECHAT_PAY_PLATFORM_CERT_PEM`（fail-closed 策略，5.40 经验）
- 回调 URL 必须是 HTTPS
- 检查 `WECHAT_PAY_SUBSCRIPTION_NOTIFY_URL` 是否正确

### Q4：数据库迁移失败
```bash
npx prisma migrate deploy
npx prisma db seed
```

---

## 成本

- **EdgeOne Pages**：免费额度（每月 100GB 流量 + 100 万次函数调用）
- **Neon Postgres**：免费档（0.5GB 存储 + 100 计算小时/月）
- **DeepSeek API**：按量计费（每千 tokens ≈ ¥0.001）
- **预估月成本**：100 用户以内基本 ¥0
