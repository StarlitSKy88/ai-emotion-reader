# 设计参考库

> 整理时间：2026-06-30
> 目的：为「问心 AI」情感解读产品提供视觉灵感

---

## 🎨 4 个核心参考网站

### 1. Variant.com
- **URL**：https://variant.com/
- **定位**：AI 设计灵感生成器
- **核心特点**：输入 idea → 滚动浏览无数 UI 设计方向
- **对您的价值**：看不同设计风格，找到情感产品最适合的方向

### 2. MotionSites.ai
- **URL**：https://motionsites.ai/
- **定位**：Hero Section 动画 prompt 库
- **核心特点**：65+ 高端 SaaS/AI 产品的 hero 动画 + 完整 prompt
- **对您的价值**：抄 prompt 用 Cursor 生成同类高端 hero

### 3. ReactBits.dev
- **URL**：https://reactbits.dev/
- **定位**：130+ React 动画组件库
- **核心特点**：Text Animations / Backgrounds / Components / Animations
- **对您的价值**：**直接复制组件**，最适合您的项目
- **GitHub**：https://github.com/DavidHDev/react-bits

### 4. Design Prompts (通用)
- **UI Prompt Library**：https://github.com/melinaclincherbuilt937/ui-prompt-library
- **StyleKit**：https://www.stylekit.top/en
- **Aceternity UI**：https://aceternity-ui.vercel.app/

---

## ⭐ 蕾姆精选的 12 个最适用组件

### 🔥 文字动画（情感产品的灵魂）

#### 1. BlurText（强烈推荐 ⭐⭐⭐⭐⭐）
- **URL**：https://reactbits.dev/text-animations/blur-text
- **效果**：文字从模糊 → 清晰渐显
- **适合**：AI 解读结果的展示，**"渐显"配合流式输出**
- **安装**：`npx shadcn@latest add @react-bits/BlurText-TS-TW`

#### 2. Shuffle（推荐 ⭐⭐⭐⭐）
- **URL**：https://reactbits.dev/text-animations/shuffle
- **效果**：字符洗牌后定格
- **适合**：标题加载、**增强"AI 正在思考"的神秘感**

#### 3. Scroll Reveal
- **URL**：https://reactbits.dev/text-animations/scroll-reveal
- **效果**：滚动时文字渐显
- **适合**：长文解读的滚动阅读

#### 4. Split Text
- **URL**：https://reactbits.dev/text-animations/split-text
- **效果**：字符级动画
- **适合**：Hero 大标题，让每个字都有温度

### 🎨 背景动画

#### 5. Aurora
- **URL**：https://reactbits.dev/backgrounds/aurora
- **效果**：极光流动
- **适合**：Hero 区背景，**温暖感**

#### 6. Beams
- **URL**：https://reactbits.dev/backgrounds/beams
- **效果**：光束
- **适合**：神秘感场景

#### 7. Particles
- **URL**：https://reactbits.dev/backgrounds/particles
- **效果**：粒子
- **适合**：**"陪伴感"主题**

#### 8. Gradient Blinds
- **URL**：https://reactbits.dev/backgrounds/gradient-blinds
- **效果**：渐变百叶窗
- **适合**：编辑感

### 💡 交互组件

#### 9. Magnet
- **URL**：https://reactbits.dev/animations/magnet
- **效果**：按钮吸附光标
- **适合**：CTA 按钮

#### 10. BlobCursor
- **URL**：https://reactbits.dev/animations/blob-cursor
- **效果**：跟随光标的变形
- **适合**：全站氛围

#### 11. CountUp
- **URL**：https://reactbits.dev/text-animations/count-up
- **效果**：数字递增
- **适合**：情绪档案数据展示

#### 12. Shiny Text
- **URL**：https://reactbits.dev/text-animations/shiny-text
- **效果**：闪光文字
- **适合**：强调重点

---

## 🎯 推荐组合方案

### 方案 A：温暖编辑感（适合情感产品）
```
Hero 区：    BlurText + Aurora
问题引导：   Split Text
解读结果：  Shuffle（神秘感）
数据展示：  CountUp
按钮：      Magnet
```

### 方案 B：现代极简感（适合 SaaS）
```
Hero 区：    BlurText + Beams
数据展示：  CountUp
按钮：      Magnet
卡片：      Pixel Card
```

### 方案 C：实验艺术感（适合年轻人群）
```
Hero 区：    Split Text + Particles
背景：      Gradient Blinds
光标：      BlobCursor
文字：      Shiny Text
```

---

## 📋 实施步骤

### Step 1：安装 React Bits（推荐）

```bash
cd /Users/opc-1/ai-emotion-reader
# 安装 CLI
npx jsrepo init
# 或用 shadcn
npx shadcn@latest add @react-bits/BlurText-TS-TW
```

### Step 2：选择 5-8 个组件加入首页

优先顺序：
1. **BlurText**（必选）- 标题渐显
2. **Aurora 或 Beams**（二选一）- 背景动画
3. **Shuffle**（强烈推荐）- 增强神秘感
4. **Magnet**（必选）- 按钮交互
5. **CountUp**（推荐）- 数据展示

### Step 3：定制化修改

每个组件都接受 props 修改颜色、速度、文本

---

## 🎨 设计参考（除 React Bits 外）

### 高端 SaaS 设计
- **Linear**：https://linear.app/（极致克制）
- **Vercel**：https://vercel.com/（现代极简）
- **Stripe**：https://stripe.com/（专业可靠）

### 情感/反思类产品
- **Sonder**：https://sonder-six.vercel.app/
- **Headspace**：https://www.headspace.com/
- **Calm**：https://www.calm.com/

### 编辑感设计
- **Rocket.new**：https://www.rocket.new/
- **Linear Method**：https://linear.app/method
- **The New Yorker**：https://www.newyorker.com/

---

## 📊 最终方案建议

基于您的项目定位（情感解读）和产品阶段（MVP），蕾姆建议：

**MVP 阶段**：用 BlurText + Aurora + Magnet 三个组件
- ✅ 立即提升视觉质量
- ✅ 不影响加载速度
- ✅ 与编辑感设计风格匹配

**M3 阶段**：增加 Beams / Particles / CountUp
- 用户有更多停留时间后
- 增加更多交互细节

---

最后更新：2026-06-30 by 蕾姆