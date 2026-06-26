"use client";

import { useState } from "react";
import EmotionForm, { UserFormData } from "@/components/EmotionForm";
import ResultDisplay from "@/components/ResultDisplay";

type Stage = "form" | "summary" | "full";

export default function Home() {
  const [stage, setStage] = useState<Stage>("form");
  const [summary, setSummary] = useState("");
  const [fullText, setFullText] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserFormData | null>(null);

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
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
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
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
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

  return (
    <div className="min-h-screen">
      {/* 表单阶段 - 编辑设计主页面 */}
      {stage === "form" && (
        <main className="animate-fade-in">
          {/* 顶部导航栏 */}
          <header className="border-b hairline">
            <div className="container-editor-wide flex items-center justify-between py-4">
              <div className="font-serif text-lg font-medium tracking-tight">
                问心 AI
              </div>
              <div className="flex items-center gap-6 text-sm text-ink-light">
                <span className="hidden sm:inline">情感解忧 · 随时在场</span>
              </div>
            </div>
          </header>

          {/* Hero Section - 问题开场 */}
          <section className="container-editor-wide py-16 md:py-24">
            <div className="max-w-3xl">
              <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-6">
                Wenxin AI · 情感解读服务
              </div>
              <h1 className="font-serif text-display-md md:text-display-lg text-ink mb-6 text-balance">
                你说的每一句心事，<br className="hidden sm:block" />
                都有 AI 在认真听。
              </h1>
              <p className="text-lg md:text-xl text-ink-light leading-relaxed text-pretty max-w-2xl">
                基于 AI 算法与心理学模型，为你生成 1500+ 字深度个性化解读。
                不是算命，不是占卜 —— 是用 AI 给你一面情感镜子。
              </p>
            </div>
          </section>

          {/* 表单区 - 编辑感容器 */}
          <section className="container-editor-wide pb-16">
            <div className="border-t hairline pt-12">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 lg:gap-16">
                {/* 左侧 - 表单 */}
                <div>
                  <EmotionForm onSubmit={handleFormSubmit} loading={loading} />
                </div>

                {/* 右侧 - 说明 */}
                <aside className="lg:border-l lg:hairline lg:pl-12">
                  <div className="sticky top-8">
                    <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-4">
                      关于这次解读
                    </div>
                    <h3 className="font-serif text-xl text-ink mb-4">
                      你将获得
                    </h3>
                    <ul className="space-y-4 text-sm text-ink-light leading-relaxed">
                      <li>
                        <span className="font-serif text-base text-ink block mb-1">一份专属画像</span>
                        AI 透过表面看到你没意识到的层面
                      </li>
                      <li>
                        <span className="font-serif text-base text-ink block mb-1">深层模式洞察</span>
                        你重复出现的心理卡点与盲点
                      </li>
                      <li>
                        <span className="font-serif text-base text-ink block mb-1">可行动建议</span>
                        3 条本周就能开始的小动作
                      </li>
                      <li>
                        <span className="font-serif text-base text-ink block mb-1">温暖陪伴</span>
                        AI 的私语，只给你看
                      </li>
                    </ul>

                    <div className="mt-8 pt-8 border-t hairline">
                      <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-3">
                        隐私承诺
                      </div>
                      <p className="text-sm text-ink-light leading-relaxed">
                        你的所有信息仅用于本次解读，不会被保存或分享。
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>

          {/* 底部 Footer */}
          <footer className="border-t hairline mt-16">
            <div className="container-editor-wide py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-sm text-ink-light">
                © 2026 问心 AI · 基于 AI 算法 + 心理学模型
              </div>
              <div className="text-xs text-ink-muted">
                本服务仅供娱乐参考和心理陪伴，不构成专业心理咨询或医疗诊断
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* 摘要/完整解读阶段 */}
      {(stage === "summary" || stage === "full") && formData && (
        <main className="animate-fade-in">
          <header className="border-b hairline">
            <div className="container-editor-wide flex items-center justify-between py-4">
              <button
                onClick={handleReset}
                className="font-serif text-lg font-medium tracking-tight hover:opacity-70 transition"
              >
                问心 AI
              </button>
              <div className="flex items-center gap-6 text-sm text-ink-light">
                <span>{loading ? "AI 正在为你解读" : "✓ 解读完成"}</span>
              </div>
            </div>
          </header>

          <section className="container-editor-wide py-12 md:py-16">
            <ResultDisplay
              summary={summary}
              fullText={fullText}
              loading={loading}
              userName={formData.name}
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
      )}
    </div>
  );
}