# 🌙 问心 AI - 情感解读工具

> 基于 MiniMax-M3 大模型驱动的个性化情感解读工具，温暖、共情、永不评判。
> 一行配置切换任何 OpenAI 兼容的大模型。

---

## ✨ 核心特性

- 🤖 **MiniMax-M3 驱动** - 国内大模型，国内访问快、中文能力强
- 📜 **1500+ 字深度报告** - 现状画像 + 深层洞察 + 可执行建议
- 🌊 **流式输出** - 实时显示 AI 输出，体验流畅
- 🎣 **内置引流钩子** - 免费摘要 + 完整版解锁 + 微信引导
- 📱 **移动端优先** - 完美适配手机访问
- 🎨 **暗色调玄学风** - 神秘、温暖、专业
- 🔄 **一键切换模型** - 支持 DeepSeek/Kimi/GLM/Qwen 等任何 OpenAI 兼容 API

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd /Users/opc-1/ai-emotion-reader
npm install
```

### 2. 配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，**只填一行 API Key** 就能跑：

```env
LLM_API_KEY=你的_MiniMax-M3_API_Key
```

> 🔑 没有 API Key？去 https://api.minimaxi.com 注册获取（新用户有免费额度）

### 3. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 即可看到效果。

### 4. 构建生产版本

```bash
npm run build
npm run start
```

---

## 🌐 部署到 EdgeOne Pages（推荐，30 分钟上线）

### 准备工作

1. 在 [GitHub](https://github.com) 创建账号并创建新仓库
2. 在 [EdgeOne Pages](https://console.cloud.tencent.com/edgeone/pages) 注册腾讯云账号

### 部署步骤

```bash
# 1. 初始化 Git 并推送到 GitHub
cd /Users/opc-1/ai-emotion-reader
git init
git add .
git commit -m "feat: 问心 AI 情感解读工具 (MiniMax-M3)"
git remote add origin https://github.com/你的用户名/ai-emotion-reader.git
git push -u origin main
```

然后在 EdgeOne Pages 控制台：

1. 点击 **「新建项目」** → **「导入 Git 仓库」**
2. 选择刚才创建的 GitHub 仓库
3. 配置构建设置：
   - **框架预设**：Next.js
   - **构建命令**：`npm run build`
   - **输出目录**：`.next`
   - **安装命令**：`npm install`
4. 在 **「环境变量」** 添加：
   ```
   LLM_API_KEY = 你的_API_Key
   LLM_BASE_URL = https://api.minimaxi.com/v1
   LLM_MODEL = MiniMax-M3
   NEXT_PUBLIC_SITE_NAME = 问心 AI
   NEXT_PUBLIC_WECHAT_ID = 你的微信号
   ```
5. 点击 **「部署」**，等待 2-3 分钟

部署成功后会得到一个 `*.pages.dev` 的免费域名。

### 自动部署

后续每次 push 代码，EdgeOne Pages 会自动部署新版本。

---

## 🔄 切换其他模型

只需修改 `.env.local` 中注释掉的部分，例如切换到 DeepSeek：

```env
# 注释掉 MiniMax-M3
# LLM_API_KEY=minimax_key

# 启用 DeepSeek
LLM_PROVIDER=deepseek
LLM_API_KEY=sk-你的_deepseek_key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
```

**支持的模型**（任何 OpenAI 兼容 API）：

| 模型 | 速度 | 成本 | 中文能力 | 推荐场景 |
|------|------|------|---------|---------|
| **MiniMax-M3** | ⭐⭐⭐⭐ | 💰 | ⭐⭐⭐⭐⭐ | 情感解读（默认）|
| DeepSeek V3 | ⭐⭐⭐⭐ | 💰 | ⭐⭐⭐⭐⭐ | 高质量低成本 |
| Kimi | ⭐⭐⭐ | 💰💰 | ⭐⭐⭐⭐⭐ | 长文本 |
| GLM-4 | ⭐⭐⭐⭐ | 💰 | ⭐⭐⭐⭐ | 通用 |
| Qwen | ⭐⭐⭐⭐ | 💰 | ⭐⭐⭐⭐ | 通用 |
| GPT-4 | ⭐⭐ | 💰💰💰 | ⭐⭐⭐⭐ | 顶级质量 |

---

## 📁 项目结构

```
ai-emotion-reader/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 首页（表单+结果）
│   ├── globals.css             # 全局样式（暗色调玄学风）
│   └── api/
│       ├── analyze/route.ts    # 完整解读 API（流式）
│       └── summary/route.ts    # 免费摘要 API（流式）
├── components/
│   ├── EmotionForm.tsx         # 用户输入表单
│   └── ResultDisplay.tsx       # 结果展示（含引流钩子）
├── lib/
│   ├── llm.ts                  # 统一 LLM 客户端（OpenAI 兼容）
│   └── prompts.ts              # 精心设计的 Prompt 模板
├── .env.local.example          # 环境变量模板（含多模型示例）
├── tailwind.config.ts          # 暗色调主题配置
└── package.json
```

---

## 🎯 商业模式

### 4 档产品设计

| 产品 | 价格 | 包含 |
|------|------|------|
| 免费体验 | ¥0 | 300 字 AI 摘要 |
| 入门款 | ¥198 | 1500 字解读 + 基础手链 |
| 进阶款 | ¥498 | 1500 字解读 + 定制手链 + 30 天陪伴 |
| 高端款 | ¥1999 | 1v1 咨询 + 多款定制 + 90 天陪伴 |
| 旗舰款 | ¥9999 | 全年私人顾问（限 10 名）|

### 流量路径

```
[公域引流]              [私域沉淀]            [成交转化]
小红书笔记   ─┐
视频号视频   ─┼→ 微信个人号 ─→  AI 解读服务
朋友圈分享   ─┤              ↘  配套手链
熟人推荐     ─┘
```

---

## 🛠 技术栈

- **Next.js 14** - React 全栈框架（App Router）
- **TypeScript** - 类型安全
- **Tailwind CSS** - 快速美化
- **OpenAI SDK** - 兼容 MiniMax-M3 / DeepSeek / Kimi 等
- **Edge Runtime** - 全球低延迟
- **EdgeOne Pages** - 国内 CDN 免费部署

---

## ⚠️ 合规提醒

- ❌ 不要使用"算命"、"占卜"、"转运"等敏感词
- ❌ 不要做"绝对化"承诺
- ❌ 不要宣称"医疗"、"宗教"效果
- ✅ 用"AI 心理学"、"情感分析"、"个性化解读"包装
- ✅ 在所有 AI 输出结尾加"仅供娱乐参考"声明
- ✅ 遇到严重心理危机，引导用户寻求专业帮助

---

## 💰 成本估算（MiniMax-M3）

### 启动成本

| 项目 | 费用 |
|------|------|
| MiniMax-M3 API（首批 1000 次）| 极低（具体见 MiniMax 官网）|
| EdgeOne Pages 部署 | 免费 |
| 域名（可选）| ~¥60/年 |
| **总计** | **< ¥100** |

### 单次成本估算（按 2000 tokens 输出）

- 输入 ~1500 tokens
- 输出 ~2000 tokens
- **单次完整解读成本**：约 ¥0.1-0.3（远低于 Claude）

### 收入预测

- 客单价 ¥198，毛利率 > 95%
- 月服务 100 个客户 = ¥19,750+ 净利润
- 月服务 500 个客户 = ¥98,750+ 净利润

---

## 🎨 定制指南

### 修改主题色

编辑 `tailwind.config.ts` 中的 `mystic` 和 `night` 颜色配置。

### 修改 Prompt

编辑 `lib/prompts.ts`：

- `buildFullPrompt()` - 完整解读风格
- `buildSummaryPrompt()` - 摘要风格
- `SYSTEM_PROMPT` (在 llm.ts 中) - AI 角色定义

### 修改微信引流文案

编辑 `components/ResultDisplay.tsx` 中的微信卡片部分。

---

## 📞 联系作者

- 项目作者：问心先生
- 项目地址：`/Users/opc-1/ai-emotion-reader`

---

## 📄 License

MIT - 自由使用、修改、商用

---

*🌙 愿每个被生活困住的人，都能找到一个愿意认真倾听的对象。*