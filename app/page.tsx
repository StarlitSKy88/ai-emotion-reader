"use client";

import { useState, useEffect } from "react";
import EmotionForm, { UserFormData } from "@/components/EmotionForm";
import ResultDisplay from "@/components/ResultDisplay";
import BlurText from "@/components/animations/BlurText";
import ParticleTrail from "@/components/animations/ParticleTrail";

type Stage = "form" | "summary" | "full";

export default function Home() {
  const [stage, setStage] = useState<Stage>("form");
  const [summary, setSummary] = useState("");
  const [fullText, setFullText] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserFormData | null>(null);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const wechatId =
    process.env.NEXT_PUBLIC_WECHAT_ID || "your_wechat_id_here";
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "问心 AI";

  const handleFormSubmit = async (data: UserFormData) => {
    setFormData(data);
    setLoading(true);
    setSummary("");
    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("生成摘要失败");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setSummary(accumulated);
        }
      }
      setStage("summary");
    } catch (error) {
      console.error(error);
      alert("服务暂时不可用");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestFull = async () => {
    if (!formData) return;
    setLoading(true);
    setFullText("");
    setStage("full");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("生成解读失败");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setFullText(accumulated);
        }
      }
    } catch (error) {
      console.error(error);
      alert("生成完整解读失败");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStage("form");
    setSummary("");
    setFullText("");
    setFormData(null);
  };

  const scrollToForm = () => {
    document.getElementById("form-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setTimeout(() => setEmailSubmitted(true), 500);
  };

  // 摘要/完整解读阶段
  if (stage === "summary" || (stage === "full" && formData)) {
    return (
      <main className="min-h-screen bg-paper-100 text-ink">
        <header className="border-b hairline">
          <div className="container-editor-wide flex items-center justify-between py-4">
            <button
              onClick={handleReset}
              className="font-serif text-lg font-medium tracking-tight hover:opacity-70 transition"
            >
              问心 AI
            </button>
            <div className="text-sm text-ink-light">
              {loading ? "AI 正在为你解读" : "✓ 解读完成"}
            </div>
          </div>
        </header>

        <section className="container-editor-wide py-12 md:py-16">
          <ResultDisplay
            summary={summary}
            fullText={fullText}
            loading={loading}
            userName={formData!.name}
            onRequestFull={handleRequestFull}
            wechatId={wechatId}
          />
        </section>

        <footer className="border-t hairline mt-16">
          <div className="container-editor-wide py-8 text-center text-sm text-ink-light">
            © 2026 问心 AI
          </div>
        </footer>
      </main>
    );
  }

  // 主页 - 白底深字 + 中文 + 中文粒子
  return (
    <main className="min-h-screen bg-paper-100 text-ink">
      {/* 顶部导航 */}
      <header className="relative z-20 bg-paper-100">
        <div className="container-editor-wide flex items-center justify-between py-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-ink flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-paper-100"></div>
            </div>
            <span className="font-serif text-lg font-medium tracking-tight">
              问心 AI
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-10 text-sm text-ink-light">
            <a href="#features" className="hover:text-ink transition">
              服务
            </a>
            <a href="#cases" className="hover:text-ink transition">
              案例
            </a>
            <a href="#pricing" className="hover:text-ink transition">
              定价
            </a>
            <a href="#faq" className="hover:text-ink transition">
              关于
            </a>
          </nav>
          <a
            href="/auth/signin"
            className="px-4 py-2 rounded-full border border-ink-300 text-sm text-ink hover:bg-ink hover:text-paper transition"
          >
            登录
          </a>
        </div>
      </header>

      {/* Hero - 白底深字 + 中文 */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* 金色粒子背景 */}
        <ParticleTrail
          color="#D97706"
          className="opacity-50"
        />

        {/* Hero 内容 */}
        <div className="relative z-20 container-editor-wide text-center pt-12 pb-16">
          <div className="max-w-3xl mx-auto">
            {/* 顶部小标签 */}
            <div className="inline-block mb-8 px-4 py-1.5 rounded-full border border-ink-200 bg-paper-200/50">
              <span className="font-instrument-serif text-sm italic text-ink-light">
                Manifesto · 宣言
              </span>
            </div>

            {/* 大字标题 */}
            <h1 className="font-instrument-serif text-6xl md:text-8xl italic text-ink mb-10 leading-[1.05] tracking-tight">
              <BlurText
                text="写给"
                className="inline-block"
                delay={50}
              />
              <br />
              <BlurText
                text="保持好奇的你"
                className="inline-block italic"
                delay={400}
              />
            </h1>

            {/* 副标题 */}
            <p className="text-lg md:text-xl text-ink-light leading-relaxed max-w-xl mx-auto mb-12">
              基于 AI 算法 + 心理学模型，为你生成 1500+ 字深度个性化情感解读。
              <br />
              不是算命，不是占卜 —— 是用 AI 给你一面情感镜子。
            </p>

            {/* 邮箱订阅框（玻璃质感 + 中文）*/}
            <form
              onSubmit={handleEmailSubmit}
              className="mb-6 max-w-md mx-auto"
            >
              <div className="flex items-center bg-white/80 backdrop-blur-xl border border-ink-200 rounded-full p-1.5 pl-5 shadow-lg shadow-ink-100/30 transition focus-within:border-ink">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="输入您的邮箱"
                  className="flex-1 bg-transparent text-ink placeholder:text-ink-light/50 text-sm focus:outline-none"
                  disabled={emailSubmitted}
                />
                <button
                  type="submit"
                  disabled={emailSubmitted}
                  className="w-10 h-10 rounded-full bg-ink text-paper-100 flex items-center justify-center hover:bg-ink-700 hover:scale-110 transition-all duration-300 disabled:opacity-50"
                >
                  {emailSubmitted ? "✓" : "→"}
                </button>
              </div>
            </form>

            <p className="text-xs text-ink-light">
              {emailSubmitted ? "✓ 订阅成功，请查收邮件" : "订阅我们的周报，获取最新情感洞察"}
            </p>

            {/* 数据条 */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-ink-light">
              <span>5000+ 用户正在使用</span>
              <span className="opacity-40">·</span>
              <span>30 秒生成</span>
              <span className="opacity-40">·</span>
              <span>1500+ 字深度报告</span>
              <span className="opacity-40">·</span>
              <span>完全匿名私密</span>
            </div>
          </div>
        </div>

        {/* 底部社交图标 */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 text-ink-light z-20">
          <a href="#" className="hover:text-ink transition" aria-label="Instagram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01" />
            </svg>
          </a>
          <a href="#" className="hover:text-ink transition" aria-label="Twitter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
            </svg>
          </a>
          <a href="#" className="hover:text-ink transition" aria-label="LinkedIn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            </svg>
          </a>
        </div>
      </section>

      {/* Features - 米色背景 + 深字 */}
      <section id="features" className="bg-paper-200 text-ink py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-4">
            我们提供什么
          </div>
          <h2 className="font-instrument-serif text-4xl md:text-6xl italic text-ink mb-16 max-w-3xl leading-tight">
            一个工具，看见完整的你
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: "01",
                title: "深度个性化解读",
                desc: "结合你的童年、关系模式、自我描述，AI 给出真正'看见你'的洞察，不是泛泛而谈的模板。",
              },
              {
                num: "02",
                title: "多轮深度对话",
                desc: "不是一次性报告。你可以继续追问，AI 基于上下文给到更深层的回应，建立真正的陪伴关系。",
              },
              {
                num: "03",
                title: "情绪成长追踪",
                desc: "所有解读、对话、行动打卡都会被记录，帮你看见自己一段时间内的情绪变化与成长轨迹。",
              },
            ].map((feature) => (
              <div
                key={feature.num}
                className="border hairline rounded-2xl p-8 bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-4">
                  {feature.num}
                </div>
                <h3 className="font-instrument-serif text-2xl italic text-ink mb-4">
                  {feature.title}
                </h3>
                <p className="text-ink-light leading-relaxed text-pretty">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cases - 白底 + 深字 */}
      <section id="cases" className="bg-paper-100 text-ink py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-4">
            真实声音
          </div>
          <h2 className="font-instrument-serif text-4xl md:text-6xl italic text-ink mb-4 max-w-3xl leading-tight">
            来自 5000+ 用户的真实反馈
          </h2>
          <p className="text-ink-light mb-16 max-w-2xl">
            以下案例已脱敏处理。我们保留原始情绪内核，但隐去可识别信息。
          </p>

          <div className="space-y-16">
            {[
              {
                quote:
                  "我以为 AI 只是帮我整理思路，但它说出了我没意识到的童年模式——那种'永远要被认可'的渴望。看完解读我哭了一场，然后开始重新审视自己。",
                author: "28 岁 · 互联网产品经理",
                topic: "职业倦怠与自我价值",
              },
              {
                quote:
                  "第三次追问的时候，AI 给我的建议让我突然想通了和男朋友的问题——原来我不是'作'，我是真的在关系里缺少安全感。",
                author: "26 岁 · 设计师",
                topic: "亲密关系中的回避",
              },
              {
                quote:
                  "我一直觉得自己没主见，看完解读才发现我不是没主见——是太在意别人感受，习惯压抑自己的需求。这是我第一次被认真'看见'。",
                author: "32 岁 · 教师",
                topic: "自我认知与边界",
              },
            ].map((item, i) => (
              <article key={i} className="max-w-3xl">
                <p className="font-instrument-serif text-2xl md:text-3xl italic text-ink leading-snug mb-6 text-balance">
                  "{item.quote}"
                </p>
                <div className="flex items-baseline gap-4 text-sm text-ink-light">
                  <span className="text-ink">{item.author}</span>
                  <span className="opacity-60">· {item.topic}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Form - 米色背景 */}
      <section id="form-section" className="bg-paper-200 text-ink py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-center mb-16">
            <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-4">
              现在开始
            </div>
            <h2 className="font-instrument-serif text-4xl md:text-6xl italic text-ink mb-6 max-w-3xl mx-auto leading-tight">
              准备好被认真看见了吗？
            </h2>
            <p className="text-ink-light text-lg max-w-2xl mx-auto">
              12 个深度问题，30 秒 AI 解读，1500+ 字专属报告。
              <br />
              完全匿名，完全私密。
            </p>
          </div>

          <EmotionForm onSubmit={handleFormSubmit} loading={loading} />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper-100 text-ink py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-4">
            定价方案
          </div>
          <h2 className="font-instrument-serif text-4xl md:text-6xl italic text-ink mb-16 max-w-3xl leading-tight">
            选择适合你的方案
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { tier: "体验", price: "免费", features: ["300 字 AI 摘要"], cta: "立即开始", highlight: false },
              {
                tier: "标准",
                price: "¥198",
                features: ["1500+ 字完整解读", "可追问 3 轮", "7 天行动建议"],
                cta: "选择标准",
                highlight: true,
              },
              {
                tier: "进阶",
                price: "¥498",
                features: ["完整解读", "无限追问", "30 天陪伴", "情绪档案"],
                cta: "选择进阶",
                highlight: false,
              },
              {
                tier: "私人顾问",
                price: "¥9999",
                features: ["全年深度陪伴", "一对一服务", "限量 10 个名额"],
                cta: "咨询",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  plan.highlight
                    ? "bg-ink text-paper border-2 border-ink"
                    : "bg-white border hairline"
                }`}
              >
                <div
                  className={`text-xs font-mono uppercase tracking-wider mb-3 ${
                    plan.highlight ? "text-paper-300" : "text-ink-light"
                  }`}
                >
                  {plan.tier}
                </div>
                <div className="font-instrument-serif text-3xl italic mb-6">
                  {plan.price}
                </div>
                <ul className="space-y-2 mb-8">
                  {plan.features.map((f, i) => (
                    <li
                      key={i}
                      className={`text-sm flex items-baseline gap-2 ${
                        plan.highlight ? "text-paper-300" : "text-ink-light"
                      }`}
                    >
                      <span className="opacity-60">·</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={plan.tier === "体验" ? scrollToForm : undefined}
                  className={`w-full text-sm py-3 rounded-full font-medium transition ${
                    plan.highlight
                      ? "bg-paper text-ink hover:bg-paper-200"
                      : "border hairline hover:bg-ink hover:text-paper"
                  }`}
                >
                  {plan.cta} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-paper-200 text-ink py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-4">
            常见问题
          </div>
          <h2 className="font-instrument-serif text-4xl md:text-6xl italic text-ink mb-16 max-w-3xl leading-tight">
            你可能想知道
          </h2>

          <div className="space-y-8 max-w-3xl">
            {[
              {
                q: "这和算命、塔罗有什么区别？",
                a: "AI 解读基于心理学模型和认知科学，不是神秘学。我们不做预测、不讲命运，而是帮你看见自己的模式、需求和可能的行动方向。",
              },
              {
                q: "我的信息会被保存吗？",
                a: "你的解读历史会被保存在你的账户档案中（用于情绪追踪），但不会被用于训练 AI，也不会与第三方分享。你可以随时删除。",
              },
              {
                q: "AI 真的能比心理咨询师更好吗？",
                a: "不能替代专业心理咨询（特别是严重心理困扰时）。AI 的优势是随时在线、不评判、便宜；心理咨询师的优势是深度共情和临床经验。我们建议：轻度情感需求用 AI，严重时找专业咨询师。",
              },
              {
                q: "为什么不是免费的？",
                a: "AI 调用成本 + 持续运营需要付费。我们用订阅制让深度服务可负担。¥498/30 天的进阶款，平均每天不到 ¥17。",
              },
            ].map((item, i) => (
              <details
                key={i}
                className="border-b hairline pb-8 group"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <h3 className="font-instrument-serif text-xl italic text-ink pr-8">
                    {item.q}
                  </h3>
                  <span className="text-ink-light text-2xl group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="text-ink-light leading-relaxed mt-4 text-pretty">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-paper-100 border-t hairline py-12">
        <div className="container-editor-wide flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="font-serif text-lg font-medium mb-2">问心 AI</div>
            <div className="text-xs text-ink-light">
              © 2026 问心 AI · 写给保持好奇的你
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-ink-light">
            <a href="#" className="hover:text-ink transition">隐私政策</a>
            <a href="#" className="hover:text-ink transition">用户协议</a>
            <a href="#" className="hover:text-ink transition">联系我们</a>
          </div>
        </div>
      </footer>
    </main>
  );
}