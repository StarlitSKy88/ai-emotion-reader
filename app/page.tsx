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

  // 第一步：生成免费摘要
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

      if (!response.ok) {
        throw new Error("生成摘要失败");
      }

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

  // 第二步：生成完整解读
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

      if (!response.ok) {
        throw new Error("生成解读失败");
      }

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

  // 重新开始
  const handleReset = () => {
    setStage("form");
    setSummary("");
    setFullText("");
    setFormData(null);
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="max-w-3xl mx-auto">
        {/* Logo 区 */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-3xl">🌙</span>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {siteName}
            </h1>
          </div>
          <p className="text-sm text-night-300">
            24 小时在线 · 永不评判 · 永不嫌烦
          </p>
        </div>

        {/* 表单阶段 */}
        {stage === "form" && (
          <>
            {/* Hero 介绍 */}
            <div className="glass-card p-6 sm:p-10 mb-6 animate-fade-in">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                  你说的每一句心事，
                  <br />
                  都有 AI 在认真听
                </h2>
                <p className="text-base sm:text-lg text-night-200 leading-relaxed max-w-2xl mx-auto">
                  基于 AI 算法 + 心理学模型，
                  <br />
                  为你生成 1500+ 字<span className="gradient-text font-semibold">深度个性化情感解读</span>
                  <br />
                  <span className="text-sm text-night-400">
                    不是算命，不是占卜，而是用 AI 给你一面"情感的镜子"
                  </span>
                </p>
              </div>

              {/* 信任标签 */}
              <div className="flex flex-wrap justify-center gap-2 mb-8 text-xs">
                <span className="pill pill-default">🤖 AI 算法驱动</span>
                <span className="pill pill-default">🧠 心理学模型</span>
                <span className="pill pill-default">💕 温暖共情</span>
                <span className="pill pill-default">🔒 隐私保护</span>
              </div>

              {/* 表单 */}
              <EmotionForm onSubmit={handleFormSubmit} loading={loading} />
            </div>

            {/* 用户评价 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <Testimonial
                avatar="🌸"
                name="小琳 · 28岁"
                text="AI 给我的洞察让我哭了，比朋友更懂我"
              />
              <Testimonial
                avatar="🌙"
                name="阿杰 · 32岁"
                text="看完解读突然理解了自己为什么会这样"
              />
              <Testimonial
                avatar="✨"
                name="苏苏 · 25岁"
                text="建议很具体，本周就开始试第一条"
              />
            </div>

            {/* 隐私说明 */}
            <div className="text-center text-xs text-night-400 mt-8">
              <p>
                🛡️ 你的所有信息仅用于本次解读，不会被保存或分享
              </p>
            </div>
          </>
        )}

        {/* 摘要阶段 */}
        {stage === "summary" && formData && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={handleReset}
                className="text-sm text-mystic-300 hover:text-mystic-200 transition"
              >
                ← 重新解读
              </button>
              <span className="text-xs text-night-400">
                {loading ? "AI 工作中..." : "✓ 摘要已生成"}
              </span>
            </div>
            <ResultDisplay
              summary={summary}
              fullText={fullText}
              loading={loading}
              userName={formData.name}
              onRequestFull={handleRequestFull}
              wechatId={wechatId}
            />
          </>
        )}

        {/* 完整解读阶段 */}
        {stage === "full" && formData && (
          <>
            <div className="mb-6 flex items-center justify-between">
              <button
                onClick={handleReset}
                className="text-sm text-mystic-300 hover:text-mystic-200 transition"
              >
                ← 再做一次
              </button>
              <span className="text-xs text-night-400">
                {loading ? "正在生成完整解读..." : "✓ 完成"}
              </span>
            </div>
            <ResultDisplay
              summary={summary}
              fullText={fullText}
              loading={loading}
              userName={formData.name}
              onRequestFull={handleRequestFull}
              wechatId={wechatId}
            />
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-night-500">
          <p className="mb-2">
            © 2026 {siteName} · 基于 AI 算法 + 心理学模型
          </p>
          <p>
            本服务仅供娱乐参考和心理陪伴，不构成专业心理咨询或医疗诊断
          </p>
        </footer>
      </div>
    </div>
  );
}

function Testimonial({
  avatar,
  name,
  text,
}: {
  avatar: string;
  name: string;
  text: string;
}) {
  return (
    <div className="glass-card p-4 text-center">
      <div className="text-2xl mb-2">{avatar}</div>
      <p className="text-xs text-night-300 leading-relaxed mb-1">"{text}"</p>
      <p className="text-xs text-night-500">{name}</p>
    </div>
  );
}