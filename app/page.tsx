"use client";

import { useState, useEffect } from "react";
import EmotionForm, { UserFormData } from "@/components/EmotionForm";
import ResultDisplay from "@/components/ResultDisplay";
import BlurText from "@/components/animations/BlurText";
import Aurora from "@/components/animations/Aurora";
import Magnet from "@/components/animations/Magnet";
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
      alert("服务暂时不可用，请稍后再试");
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
      alert("生成完整解读失败，请稍后再试");
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
    // MVP: 模拟提交
    setTimeout(() => setEmailSubmitted(true), 500);
  };

  // 摘要/完整解读阶段
  if (stage === "summary" || (stage === "full" && formData)) {
    return (
      <main className="min-h-screen">
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

  // 主页 - Asme 风格
  return (
    <main className="min-h-screen bg-black text-paper">
      {/* 顶部导航 */}
      <header className="relative z-20">
        <div className="container-editor-wide flex items-center justify-between py-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-paper flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-paper"></div>
            </div>
            <span className="font-instrument-serif text-xl italic">
              Wenxin AI
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-10 text-sm text-paper-300">
            <a href="#features" className="hover:text-paper transition">
              Features
            </a>
            <a href="#cases" className="hover:text-paper transition">
              Cases
            </a>
            <a href="#pricing" className="hover:text-paper transition">
              Pricing
            </a>
            <a href="#faq" className="hover:text-paper transition">
              About
            </a>
          </nav>
          <a
            href="/auth/signin"
            className="px-4 py-2 rounded-full border border-paper-300 text-sm text-paper-300 hover:bg-paper hover:text-ink transition"
          >
            Sign In
          </a>
        </div>
      </header>

      {/* Hero - Asme 风格 */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* 粒子轨迹背景 */}
        <ParticleTrail
          color="#D97706"
          particleCount={100}
          speed={0.5}
          trailLength={30}
        />

        {/* 中央装饰图（用户截图中的"Manifesto"形象） */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] z-10">
          <div className="relative w-full h-full">
            {/* 中心装饰圆 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-80 h-80 rounded-full bg-gradient-to-br from-amber-900/40 to-stone-900/40 backdrop-blur-sm flex items-center justify-center">
                <div className="w-64 h-64 rounded-full bg-gradient-to-br from-amber-800/30 to-stone-800/50 backdrop-blur-md flex items-center justify-center">
                  {/* "Manifesto" 标签 */}
                  <div className="bg-black/40 backdrop-blur-md border border-paper-300/30 rounded-full px-6 py-2">
                    <span className="font-instrument-serif text-2xl italic text-paper">
                      Manifesto
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero 内容 */}
        <div className="relative z-20 container-editor-wide text-center pt-20">
          <div className="max-w-2xl mx-auto">
            <h1 className="font-instrument-serif text-6xl md:text-8xl italic text-paper mb-12 leading-tight">
              <BlurText
                text="Built for"
                className="inline-block"
                delay={50}
              />
              <br />
              <BlurText
                text="the curious"
                className="inline-block italic"
                delay={400}
              />
            </h1>

            {/* 邮箱订阅框 */}
            <form
              onSubmit={handleEmailSubmit}
              className="mb-8 max-w-md mx-auto"
            >
              <div className="flex items-center bg-black/40 backdrop-blur-md border border-paper-300/30 rounded-full p-1.5 pl-5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="flex-1 bg-transparent text-paper placeholder:text-paper-300/50 text-sm focus:outline-none"
                  disabled={emailSubmitted}
                />
                <button
                  type="submit"
                  disabled={emailSubmitted}
                  className="w-10 h-10 rounded-full bg-paper text-black flex items-center justify-center hover:bg-paper-100 transition disabled:opacity-50"
                >
                  {emailSubmitted ? "✓" : "→"}
                </button>
              </div>
            </form>

            <p className="text-sm text-paper-300/80 leading-relaxed max-w-md mx-auto">
              Stay updated with the latest emotional insights.
              <br />
              Subscribe to our newsletter today.
            </p>
          </div>
        </div>

        {/* 底部社交图标 */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 text-paper-300 z-20">
          <a href="#" className="hover:text-paper transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01" />
            </svg>
          </a>
          <a href="#" className="hover:text-paper transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
            </svg>
          </a>
          <a href="#" className="hover:text-paper transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            </svg>
          </a>
        </div>
      </section>

      {/* Features - 编辑感设计 */}
      <section id="features" className="bg-paper-100 text-ink py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-4">
            What we offer
          </div>
          <h2 className="font-instrument-serif text-5xl md:text-7xl italic text-ink mb-16 text-balance max-w-3xl leading-tight">
            One tool to <em>see</em> the whole you
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: "01",
                title: "Deep Personalized Reading",
                desc: "Combining your childhood, relationship patterns, and self-description, AI gives insights that truly 'see you' — not generic templates.",
              },
              {
                num: "02",
                title: "Multi-turn Dialogue",
                desc: "Not a one-time report. You can keep asking, and AI responds based on context — building a real companion relationship.",
              },
              {
                num: "03",
                title: "Emotional Growth Tracking",
                desc: "All readings, conversations, and action check-ins are recorded — helping you see your emotional patterns over time.",
              },
            ].map((feature) => (
              <div key={feature.num} className="border hairline rounded-2xl p-8 bg-white">
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

      {/* Cases - 大字引用 */}
      <section id="cases" className="bg-black text-paper py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-xs font-mono text-paper-300 uppercase tracking-wider mb-4 opacity-70">
            Voices
          </div>
          <h2 className="font-instrument-serif text-5xl md:text-7xl italic text-paper mb-16 text-balance max-w-3xl leading-tight">
            From 5,000+ users
          </h2>

          <div className="space-y-16">
            {[
              {
                quote:
                  "I thought AI would just organize my thoughts. But it pointed out a childhood pattern I never noticed — that constant need to be 'approved'. I cried after reading.",
                author: "28 · Product Manager",
                topic: "Career burnout & self-worth",
              },
              {
                quote:
                  "The third time I asked a follow-up question, AI's advice suddenly clicked something about my relationship — I wasn't being 'needy', I was genuinely lacking security.",
                author: "26 · Designer",
                topic: "Avoidance in intimacy",
              },
              {
                quote:
                  "I always thought I had no backbone. Turns out I'm not indecisive — I just care too much about others' feelings. This is the first time I felt truly seen.",
                author: "32 · Teacher",
                topic: "Self-awareness & boundaries",
              },
            ].map((item, i) => (
              <article
                key={i}
                className="max-w-3xl"
              >
                <p className="font-instrument-serif text-2xl md:text-4xl italic text-paper leading-tight mb-6 text-balance">
                  "{item.quote}"
                </p>
                <div className="flex items-baseline gap-4 text-sm text-paper-300">
                  <span className="text-paper">{item.author}</span>
                  <span className="opacity-60">· {item.topic}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Form Section - 深色 CTA */}
      <section id="form-section" className="bg-gradient-to-b from-black to-stone-900 py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-center mb-16">
            <div className="text-xs font-mono text-paper-300 uppercase tracking-wider mb-4 opacity-70">
              Begin
            </div>
            <h2 className="font-instrument-serif text-5xl md:text-7xl italic text-paper mb-6 text-balance">
              Ready to be <em>truly seen</em>?
            </h2>
            <p className="text-paper-300 text-lg max-w-2xl mx-auto">
              12 deep questions. 30-second AI reading. 1500+ word personalized report.
              <br />
              Completely anonymous. Completely private.
            </p>
          </div>

          <EmotionForm onSubmit={handleFormSubmit} loading={loading} />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper-100 text-ink py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-4">
            Pricing
          </div>
          <h2 className="font-instrument-serif text-5xl md:text-7xl italic text-ink mb-16 max-w-3xl leading-tight">
            Choose <em>your</em> path
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { tier: "Try", price: "Free", features: ["300-word AI summary"], cta: "Start", highlight: false },
              {
                tier: "Standard",
                price: "¥198",
                features: ["1500+ word reading", "3 follow-ups", "7-day actions"],
                cta: "Choose",
                highlight: true,
              },
              {
                tier: "Advanced",
                price: "¥498",
                features: ["Full reading", "Unlimited chat", "30-day companion", "Mood archive"],
                cta: "Choose",
                highlight: false,
              },
              {
                tier: "Private",
                price: "¥9999",
                features: ["Year-long companion", "1-on-1 service", "Limited 10 slots"],
                cta: "Inquire",
                highlight: false,
              },
            ].map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-2xl p-6 ${
                  plan.highlight
                    ? "bg-black text-paper"
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
                  onClick={plan.tier === "Try" ? scrollToForm : undefined}
                  className={`w-full text-sm py-3 rounded-full font-medium transition ${
                    plan.highlight
                      ? "bg-paper text-black hover:bg-paper-200"
                      : "border hairline hover:bg-paper-200"
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
      <section id="faq" className="bg-black text-paper py-20 md:py-32">
        <div className="container-editor-wide">
          <div className="text-xs font-mono text-paper-300 uppercase tracking-wider mb-4 opacity-70">
            FAQ
          </div>
          <h2 className="font-instrument-serif text-5xl md:text-7xl italic text-paper mb-16 max-w-3xl leading-tight">
            You might <em>wonder</em>
          </h2>

          <div className="space-y-8 max-w-3xl">
            {[
              {
                q: "How is this different from fortune telling?",
                a: "AI readings are based on psychology models and cognitive science — not mysticism. We don't predict or claim fate. We help you see your patterns, needs, and possible directions.",
              },
              {
                q: "Is my data saved?",
                a: "Your reading history is saved in your personal account (for mood tracking). It's never used for AI training or shared with third parties. You can delete it anytime.",
              },
              {
                q: "Can AI replace a therapist?",
                a: "No, and it shouldn't (especially for serious mental health concerns). AI's strengths: 24/7 availability, no judgment, affordable. A therapist's strengths: deep empathy, clinical expertise. We suggest: use AI for light needs, see a professional for serious ones.",
              },
            ].map((item, i) => (
              <details
                key={i}
                className="border-b border-paper-300/20 pb-8 group"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <h3 className="font-instrument-serif text-2xl italic text-paper pr-8">
                    {item.q}
                  </h3>
                  <span className="text-paper-300 text-2xl group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="text-paper-300 leading-relaxed mt-4 text-pretty">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-paper border-t border-paper-300/20 py-12">
        <div className="container-editor-wide flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="font-instrument-serif text-2xl italic mb-2">
              Wenxin AI
            </div>
            <div className="text-xs text-paper-300 opacity-60">
              © 2026 问心 AI · Built for the curious
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs text-paper-300 opacity-60">
            <a href="#" className="hover:opacity-100 transition">Privacy</a>
            <a href="#" className="hover:opacity-100 transition">Terms</a>
            <a href="#" className="hover:opacity-100 transition">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}