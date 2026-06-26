# 🚀 EdgeOne Pages 部署指南

> 问心 AI · 5 分钟部署到腾讯云 EdgeOne Pages

---

## 📋 部署前准备

✅ 代码已推送到 GitHub：https://github.com/StarlitSKy88/ai-emotion-reader

---

## 🌐 部署步骤

### 1. 登录 EdgeOne Pages

访问：**https://console.cloud.tencent.com/edgeone/pages**

使用您的腾讯云账号登录（如果没有，用微信扫码注册一个）。

### 2. 创建新项目

点击 **「+ 新建项目」** → 选择 **「导入 Git 仓库」**

### 3. 连接 GitHub

- 点击 **「授权 GitHub」**
- 在 GitHub 授权页面选择您的账号（StarlitSKy88）
- 授权 EdgeOne Pages 访问您的仓库

### 4. 选择仓库

- **仓库**：`StarlitSKy88/ai-emotion-reader`
- **分支**：`main`
- **框架预设**：选择 **「Next.js」**（如果自动检测到了就保持默认）

### 5. 配置构建设置

| 配置项 | 值 |
|--------|-----|
| **构建命令** | `npm run build` |
| **输出目录** | `.next` |
| **安装命令** | `npm install` |
| **Node 版本** | 18.x 或 20.x（默认即可） |

### 6. 配置环境变量 ⭐ 关键步骤

点击 **「环境变量」** 按钮，添加以下 4 个变量：

| 变量名 | 值 |
|--------|-----|
| `LLM_API_KEY` | `sk-4e8e23e071184186b1a70bd7b87cbff3` |
| `LLM_BASE_URL` | `https://api.deepseek.com` |
| `LLM_MODEL` | `deepseek-v4-flash` |
| `NEXT_PUBLIC_SITE_NAME` | `问心 AI` |
| `NEXT_PUBLIC_WECHAT_ID` | `（您的微信号）` |

**重要**：建议把 DeepSeek API Key 添加到 **「生产环境」** 和 **「预览环境」** 两个环境。

### 7. 开始部署

点击 **「开始部署」** 按钮

部署过程：
- ⏱ 安装依赖：~30 秒
- ⏱ 构建项目：~60 秒
- ⏱ 部署到边缘节点：~30 秒
- ✅ 总计：~2-3 分钟

### 8. 获取部署地址

部署成功后，您会得到一个免费域名：

```
https://ai-emotion-reader-xxx.pages.dev
```

或者您可以绑定自己的域名（需备案）。

---

## ✅ 部署后验证

打开您的部署地址，测试：

- [ ] 首页正常加载（星空背景 + 玻璃拟态 UI）
- [ ] 表单可以正常填写
- [ ] 提交后能生成 AI 摘要（流式显示）
- [ ] 点击"解锁完整版"能生成完整解读
- [ ] 微信引流卡正常显示
- [ ] 移动端访问正常

---

## 🔄 后续更新

修改代码后：
```bash
git add .
git commit -m "feat: 新功能描述"
git push
```

EdgeOne Pages 会**自动检测** GitHub 推送，自动部署新版本（无需手动操作）。

---

## 💰 成本

- **EdgeOne Pages**：免费（每月 100GB 流量 + 100 万次函数调用）
- **DeepSeek API**：新用户有免费额度，按使用量计费（每千 tokens 约 0.001 元）
- **预估月成本**：100 用户以内基本 **¥0**

---

## 🆘 常见问题

### Q1：部署失败，提示 "Build failed"
**A**：检查环境变量是否完整，特别是 `LLM_API_KEY` 是否正确。

### Q2：部署成功但 API 返回错误
**A**：去 EdgeOne Pages 控制台 → 项目 → 「日志」查看具体错误。

### Q3：访问速度慢
**A**：EdgeOne Pages 默认有 CDN 加速。如还慢，可在控制台开启「智能加速」。

### Q4：想换微信号
**A**：在 EdgeOne Pages 控制台修改 `NEXT_PUBLIC_WECHAT_ID` 环境变量即可。

---

## 📞 需要帮助？

如遇问题，把错误截图发给蕾姆，蕾姆帮您排查。