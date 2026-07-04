# 问心 AI 设计系统（V3 · Prisma 深色电影感）

> 本文档固化问心 AI 落地页从 V2 浅色（paper #FAF8F5）翻转到 V3 深色电影感（black + cream #DEDBC8）后的设计规范，参考 Prisma 创意工作室模板。后续页面同步改造时以此为唯一依据。

---

## 1. 设计语言定位

**关键词：dark, moody, cinematic + warm cream**

- 深色基底带来电影感与情感张力，让"情绪"成为页面主角。
- Warm cream（#DEDBC8）作为唯一暖色锚点，在纯黑中保留"温度"，避免冷峻距离感。
- 三层深色（black / #101010 / #212121）构建空间纵深，配合 SVG 噪点纹理（fractalNoise）模拟胶片颗粒。
- 字体大尺度对比：巨字标题（26vw→19vw）vs 极小标签（10px），制造戏剧性层级。
- 动效以"揭示"为主：单词上拉、滚动逐字渐显、卡片 staggered fade，呼应"陪伴者慢慢看见情绪"的产品调性。

---

## 2. 色彩系统

### 2.1 三层深色背景

| 用途 | 色值 | 使用方式 |
| --- | --- | --- |
| 全局背景 | `#000000` | `bg-black` / `globals.css` 中 `html, body { background-color: #000000 }` |
| About 卡片背景 | `#101010` | `bg-[#101010]` |
| Features 卡片背景 | `#212121` | `bg-[#212121]` |
| 输入框背景（V2 保留，已切深色） | `#101010` | `.input-editor` |
| 输入框边框 / 分隔线 | `#212121` | `border-[#212121]` |

### 2.2 主色与文字

| 角色 | 色值 | 使用方式 |
| --- | --- | --- |
| Primary（warm cream） | `#DEDBC8` | Tailwind `text-primary` / `bg-primary` / `text-primary/70` / `text-primary/60` |
| 主文字色 | `#E1E0CC` | `style={{ color: '#E1E0CC' }}`（与 primary 略有差异，偏暖白） |
| 次要文字 | gray-400 | `text-gray-400` |
| 辅助文字 | gray-500 | `text-gray-500` |
| 文字选中态 | cream 底黑字 | `::selection { background-color: #DEDBC8; color: #000000 }` |

> **注意**：`primary` 与 `#E1E0CC` 是两个不同的 cream 值。Tailwind utility（`text-primary` 系列）走 `#DEDBC8`；inline style 中的 `#E1E0CC` 用于巨字标题、视频卡片说明等需要略偏白的位置。两者不可混用。

### 2.3 导航链接色

| 状态 | 色值 |
| --- | --- |
| 默认 | `rgba(225, 224, 204, 0.8)` （inline style） |
| Hover | `#E1E0CC` （通过 `hover:text-primary` 实现，注意 hover 走的是 primary #DEDBC8） |

### 2.4 旧调色板（V2，渐进迁移用）

`tailwind.config.ts` 仍保留 `paper` / `ink` / `accent` 旧色阶，仅供未迁移页面过渡使用。V3 全部完成后可移除。**新页面严禁使用** `paper-*` / `ink-*` / `accent`。

---

## 3. 字体系统

### 3.1 字体族

| 字体 | 字重 | 用途 | 配置位置 |
| --- | --- | --- | --- |
| Almarai | 300 / 400 / 700 / 800 | 全局默认 | `globals.css` `* { font-family: 'Almarai'... }` + `tailwind.config.ts` `fontFamily.sans` |
| Instrument Serif | italic 1 | 仅 About 段 italic accent，用 `font-serif italic` 类 | `tailwind.config.ts` `fontFamily.serif` |

### 3.2 加载方式

`app/globals.css` 顶部 `@import` Google Fonts：

```css
@import url('https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&family=Instrument+Serif:ital@1&display=swap');
```

### 3.3 使用约束

- **Almarai** 承担所有正文、标题、UI 文字。
- **Instrument Serif italic** 仅用于 About 段落中的"italic accent"片段（如 `一个关系成长陪伴者。`），通过 `font-serif italic` 类启用。不可用于其他位置。
- 全局字体由 `globals.css` 的 `* { font-family: 'Almarai'... }` 强制覆盖，无需在每个组件重复声明。

---

## 4. 自定义 CSS 工具类

定义于 `app/globals.css` 的 `@layer utilities`，均为 inline SVG data URI + `feTurbulence` 实现。

### 4.1 `.noise-overlay`（Hero 视频叠加）

- `feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"`
- 用于 Hero 段视频上方，配合 `opacity-[0.7] mix-blend-overlay pointer-events-none`。
- 视觉目的：模拟胶片颗粒，柔化视频的数字感。

### 4.2 `.bg-noise`（Features 区背景）

- `feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4"`
- 用于 Features 段全屏背景，配合 `opacity-[0.15] pointer-events-none`。
- 视觉目的：在纯黑背景上增加微弱颗粒，避免大面积死黑。

### 4.3 其他保留工具类

- `.text-balance` / `.text-pretty`：text-wrap 工具
- `.typing-cursor`：聊天页流式光标（V2 保留，已切深色 cream）
- `.reading-content`：聊天页阅读正文样式（color: #E1E0CC）
- `.input-editor` / `.input-editor-textarea`：输入框（V2 保留，已切深色）
- `.btn-editor` / `.btn-editor-secondary`：按钮（V2 保留，已切深色 cream 底黑字）
- `.link-underline`：极简下划线链接

---

## 5. 三段式布局规范

落地页 `app/page.tsx` 严格遵循 Hero / About / Features 三段式。

### 5.1 Section 1: Hero

```
section.h-screen.p-4.md:p-6
└── div.relative.w-full.h-full.rounded-2xl.md:rounded-[2rem].overflow-hidden
    ├── video（autoPlay loop muted playsInline object-cover，绝对定位铺满）
    ├── div.noise-overlay.opacity-[0.7].mix-blend-overlay.pointer-events-none
    ├── div.bg-gradient-to-b.from-black/30.via-transparent.to-black/60
    ├── nav.absolute.top-0.left-1/2.-translate-x-1/2.bg-black.rounded-b-2xl.px-4.py-2.md:px-8.z-10
    └── div.absolute.bottom-0.left-0.right-0.p-4.md:p-8.lg:p-12
        └── grid.grid-cols-12.gap-4.items-end
            ├── col-span-12.md:col-span-8：巨字标题
            └── col-span-12.md:col-span-4：描述 + CTA
```

**关键参数**：

- 外层 `p-4 md:p-6` 制造 inset（卡片浮于黑底之上）效果。
- 内层 `rounded-2xl md:rounded-[2rem] overflow-hidden` 圆角容器。
- 巨字标题：`text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw] 2xl:text-[20vw]`，`font-medium leading-[0.85] tracking-[-0.07em]`，`style={{ color: '#E1E0CC' }}`。
- 巨字由 `<WordsPullUp text="问心" showAsterisk />` 渲染。
- 描述：`text-primary/70 text-xs sm:text-sm md:text-base`，motion 入场 delay 0.5s。
- CTA 按钮：`bg-primary text-black rounded-full pl-5 pr-1 py-1`，内嵌黑色圆形 ArrowRight 图标按钮。
- 导航：`absolute top-0 left-1/2 -translate-x-1/2 bg-black rounded-b-2xl md:rounded-b-3xl px-4 py-2 md:px-8`，gap 响应式 `gap-3 sm:gap-6 md:gap-12 lg:gap-14`，字号 `text-[10px] sm:text-xs md:text-sm`。

### 5.2 Section 2: About

```
section.bg-black.py-20.md:py-32
└── div.max-w-6xl.mx-auto.px-6
    └── div.bg-[#101010].rounded-2xl.p-8.md:p-16.text-center
        ├── div.text-primary.text-[10px].sm:text-xs.mb-8（顶部小标签「情感关系」）
        ├── WordsPullUpMultiStyle（多样式主标题）
        └── p（滚动逐字揭示正文，AnimatedLetter 逐字渲染）
```

**关键参数**：

- 内卡片 `bg-[#101010] rounded-2xl p-8 md:p-16 text-center`。
- 顶部小标签：`text-primary text-[10px] sm:text-xs mb-8`。
- 多样式段落字号：`text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl`，`leading-[0.95] sm:leading-[0.9]`，`max-w-3xl mx-auto`。
- 多样式段落示例（含 italic serif accent）：
  - `{ text: '我是问心 AI，', className: 'font-normal' }`
  - `{ text: '一个关系成长陪伴者。', className: 'italic font-serif' }`
  - `{ text: '我帮你们看见情绪，梳理关系的脉络。', className: 'font-normal' }`
- 滚动逐字揭示正文：`text-[#DEDBC8] text-xs sm:text-sm md:text-base`，`style={{ lineHeight: 1.6 }}`。
- 滚动联动通过 `useScroll({ target: aboutRef, offset: ['start 0.8', 'end 0.2'] })` 驱动。

### 5.3 Section 3: Features

```
section#features.min-h-screen.bg-black.relative.py-20.md:py-32
├── div.absolute.inset-0.bg-noise.opacity-[0.15].pointer-events-none
└── div.relative.max-w-7xl.mx-auto.px-6
    ├── 标题区（WordsPullUpMultiStyle 两行）
    ├── 4 列卡片网格 grid.grid-cols-1.md:grid-cols-2.lg:grid-cols-4.gap-3.sm:gap-2.md:gap-1.lg:h-[480px]
    │   ├── Card 1: 视频卡片（rounded-2xl overflow-hidden h-[300px] md:h-full）
    │   ├── Card 2: bg-[#212121] 功能卡 (01)
    │   ├── Card 3: bg-[#212121] 功能卡 (02)
    │   └── Card 4: bg-[#212121] 功能卡 (03)
    ├── 定价区（V2 保留，套 V3 深色）
    └── Footer
```

**卡片入场动效**：

- `initial={{ scale: 0.95, opacity: 0 }}`
- `whileInView={{ scale: 1, opacity: 1 }}`
- `viewport={{ once: true, margin: '-100px' }}`
- `transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}`
- staggered delay：0s / 0.15s / 0.3s / 0.45s

**功能卡片结构**：

- 图标：`w-10 h-10 sm:w-12 sm:h-12 rounded mb-4`
- 标题+编号：`text-primary text-lg mb-3`，编号 `<span className="text-gray-500 text-sm ml-1">(0X)</span>`
- Check 列表：`<Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />` + `text-gray-400 text-sm`
- Learn more 链接：`inline-flex items-center gap-1 text-primary text-sm group`
- Learn more 箭头：`<ArrowRight style={{ transform: 'rotate(-45deg)' }} />`，hover `group-hover:translate-x-1`

**视频卡片结构**：

- `relative rounded-2xl overflow-hidden h-[300px] md:h-full`
- 视频 `absolute inset-0 w-full h-full object-cover`
- 渐变蒙层 `bg-gradient-to-t from-black/80 to-transparent`
- 底部说明 `absolute bottom-0 left-0 right-0 p-6`，`style={{ color: '#E1E0CC' }}`

---

## 6. 动效组件

三个动效组件均位于 `components/animation/`，均 `'use client'`，均基于 framer-motion。

### 6.1 `WordsPullUp`

- 路径：`components/animation/WordsPullUp.tsx`
- 行为：按空格拆分文本，每个单词独立 `motion.span`。
- 动效：`initial={{ y: 20, opacity: 0 }}` → `animate={{ y: 0, opacity: 1 }}`。
- staggered：`delay: i * 0.08`，`duration: 0.6`，`ease: [0.16, 1, 0.3, 1]`。
- 触发：`useInView(ref, { once: true, margin: '-50px' })`。
- `showAsterisk` prop：仅在最后一个单词以 `a` 结尾时，于该字符后追加 superscript `*`（position absolute, top 0.65em, fontSize 0.31em）。
- 外层 `inline-block`，单词 `marginRight: '0.25em'`。

### 6.2 `WordsPullUpMultiStyle`

- 路径：`components/animation/WordsPullUpMultiStyle.tsx`
- 行为：接收 `{ text, className }[]` 段落数组，拍平所有单词，保留每词所属段落的 className。
- 动效：同 WordsPullUp（y:20→0, staggered 0.08s, ease [0.16,1,0.3,1]）。
- 外层：`inline-flex flex-wrap justify-center ${containerClassName}`。
- 触发：`useInView(ref, { once: true, margin: '-50px' })`。

### 6.3 `AnimatedLetter`

- 路径：`components/animation/AnimatedLetter.tsx`
- 行为：每个字符独立 `motion.span`，opacity 由 `scrollYProgress` 驱动。
- 计算：`charProgress = index / totalChars`。
- opacity 映射：`useTransform(scrollYProgress, [charProgress - 0.1, charProgress + 0.05], [0.2, 1])`。
- 空格字符渲染为 `<span style={{ display: 'inline-block', width: '0.25em' }} />`。
- 滚动源：父组件 `useScroll({ target: aboutRef, offset: ['start 0.8', 'end 0.2'] })` 传入 `scrollYProgress`。

---

## 7. 响应式断点

mobile first，使用 Tailwind 默认断点 `sm` (640) / `md` (768) / `lg` (1024) / `xl` (1280) / `2xl` (1536)。

### 7.1 Hero 巨字

| 断点 | 字号 |
| --- | --- |
| 默认 | `text-[26vw]` |
| sm | `text-[24vw]` |
| md | `text-[22vw]` |
| lg | `text-[20vw]` |
| xl | `text-[19vw]` |
| 2xl | `text-[20vw]` |

### 7.2 Features 卡片网格

| 断点 | 列数 | gap | 高度 |
| --- | --- | --- | --- |
| 默认 | 1 列 | `gap-3` | `h-[300px]` |
| sm | 1 列 | `gap-2` | `h-[300px]` |
| md | 2 列 | `gap-1` | `md:h-full` |
| lg | 4 列 | `gap-1` | `lg:h-[480px]` |

### 7.3 导航 gap

| 断点 | gap | 字号 |
| --- | --- | --- |
| 默认 | `gap-3` | `text-[10px]` |
| sm | `gap-6` | `text-xs` |
| md | `gap-12` | `text-sm` |
| lg | `gap-14` | `text-sm` |

### 7.4 About 段字号

| 断点 | 主标题 | 正文 |
| --- | --- | --- |
| 默认 | `text-3xl` | `text-xs` |
| sm | `text-4xl` | `text-sm` |
| md | `text-5xl` | `text-base` |
| lg | `text-6xl` | `text-base` |
| xl | `text-7xl` | `text-base` |

### 7.5 Hero inset padding

| 断点 | section padding | 内层圆角 | 导航 padding | 底部内容 padding |
| --- | --- | --- | --- | --- |
| 默认 | `p-4` | `rounded-2xl` | `px-4 py-2` | `p-4` |
| md | `p-6` | `rounded-[2rem]` | `md:px-8` | `md:p-8` |
| lg | `p-6` | `rounded-[2rem]` | `md:px-8` | `lg:p-12` |

---

## 8. 技术栈

| 依赖 | 版本约束 | 用途 |
| --- | --- | --- |
| Next.js | 14 App Router | 框架。注意：使用 framer-motion 的页面必须 `'use client'` |
| Tailwind CSS | 3.x（`tailwind.config.ts` 已配 `primary` + `serif`） | 样式 |
| framer-motion | 已安装 | 动效（WordsPullUp / WordsPullUpMultiStyle / AnimatedLetter / motion.div） |
| lucide-react | 已安装 | 图标（`ArrowRight` / `Check`） |

### 8.1 关键文件位置

- `tailwind.config.ts`：色彩 / 字体 / 动画配置
- `app/globals.css`：全局字体、噪点工具类、V2 保留组件类
- `app/page.tsx`：落地页三段式实现
- `app/layout.tsx`：metadata / JSON-LD（落地页 SSR 由 layout 处理）
- `components/animation/WordsPullUp.tsx`
- `components/animation/WordsPullUpMultiStyle.tsx`
- `components/animation/AnimatedLetter.tsx`

### 8.2 'use client' 边界

所有 framer-motion 组件（`WordsPullUp` / `WordsPullUpMultiStyle` / `AnimatedLetter` 及 `app/page.tsx`）均需 `'use client'`。`layout.tsx` 保持 server component，SEO metadata 在 layout 层处理，client component 仍会 SSR 初始 HTML。

---

## 9. 迁移指南（V2 → V3）

### 9.1 色彩迁移

| V2 | V3 | 备注 |
| --- | --- | --- |
| `paper-texture` | `bg-black` + `.noise-overlay` / `.bg-noise` | 噪点纹理替代纸感 |
| `text-ink` / `text-ink-100` | `text-primary` 或 `style={{ color: '#E1E0CC' }}` | Tailwind utility 走 primary，inline style 走 #E1E0CC |
| `bg-paper-200` | `bg-[#101010]` | 卡片背景 |
| `bg-paper-100` | `bg-black` | 页面背景 |
| `border-ink-100` / `border-ink-200` | `border-[#212121]` | 分隔线 / 边框 |
| `text-ink-300` / `text-ink-400`（次要文字） | `text-gray-400` / `text-gray-500` | 次要文字 |
| `accent` / `accent-dark` | （暂无对应） | 新页面避免使用，旧页面待评估 |

### 9.2 字体迁移

| V2 | V3 | 备注 |
| --- | --- | --- |
| `font-serif`（Fraunces） | `font-serif italic`（Instrument Serif） | **仅 italic 用法**，且仅限 About 段 accent |
| `font-sans`（默认） | Almarai（全局 `*` 强制覆盖） | 无需显式声明 |

### 9.3 组件迁移

| V2 | V3 | 备注 |
| --- | --- | --- |
| `.btn-editor`（paper 底 ink 字） | `.btn-editor`（cream 底黑字） | 已切深色：`background-color: #DEDBC8; color: #000000` |
| `.btn-editor-secondary` | `.btn-editor-secondary` | 已切深色：transparent + `border: 1px solid #212121`，hover `bg-[#101010]` + `border-color: #DEDBC8` |
| `.input-editor` | `.input-editor` | 已切深色：`background-color: #101010; border: 1px solid #212121; color: #E1E0CC` |
| `.link-underline` | `.link-underline` | 已切深色：`text-decoration-color: rgba(225,224,204,0.3)`，hover `#DEDBC8` |
| `.typing-cursor` | `.typing-cursor` | 已切深色：`color: #DEDBC8` |
| `.reading-content` | `.reading-content` | 已切深色：`color: #E1E0CC` |

### 9.4 迁移检查清单

- [ ] 移除所有 `paper-*` / `ink-*` / `accent` 类引用
- [ ] `text-ink*` → `text-primary` / `text-gray-400` / `text-gray-500`
- [ ] `bg-paper-*` → `bg-black` / `bg-[#101010]` / `bg-[#212121]`
- [ ] `border-ink-*` → `border-[#212121]`
- [ ] `font-serif`（Fraunces）→ `font-serif italic`（Instrument Serif），且仅限 italic accent
- [ ] 确认 framer-motion 使用处已加 `'use client'`
- [ ] 确认 inline style 文字色用 `#E1E0CC`，Tailwind utility 文字色用 `text-primary`
- [ ] 大面积纯黑背景处加 `.bg-noise opacity-[0.15]` 避免死黑

---

## 附录：滚动条与焦点态

- 滚动条：`width: 6px`，thumb `#212121`，hover `#DEDBC8`，track transparent。
- 焦点态：`*:focus-visible { outline: none; box-shadow: inset 0 -1px 0 0 currentColor }`（下划线式焦点，跟随当前文字色）。
- 文字选中：`::selection { background-color: #DEDBC8; color: #000000 }`（cream 底黑字）。
