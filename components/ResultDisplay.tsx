"use client";

import { useEffect, useRef, useState } from "react";

interface ResultDisplayProps {
  summary: string;
  fullText: string;
  loading: boolean;
  userName?: string;
  onRequestFull: () => void;
  wechatId?: string;
}

export default function ResultDisplay({
  summary,
  fullText,
  loading,
  userName = "朋友",
  onRequestFull,
  wechatId = "your_wechat_id",
}: ResultDisplayProps) {
  const [copied, setCopied] = useState(false);
  const fullTextRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部（流式输出时）
  useEffect(() => {
    if (loading && fullTextRef.current) {
      fullTextRef.current.scrollTop = fullTextRef.current.scrollHeight;
    }
  }, [fullText, loading]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText || summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("复制失败", err);
    }
  };

  const handleShare = () => {
    const text = `我刚让 AI 帮我做了情感解读，结果让我震惊……${window.location.href}`;
    if (navigator.share) {
      navigator.share({
        title: "问心 AI 情感解读",
        text,
      });
    } else {
      navigator.clipboard.writeText(text);
      alert("链接已复制，去分享给朋友吧 🌹");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 免费摘要卡片 */}
      <div className="glass-card p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">✨</span>
          <h3 className="text-lg font-semibold gradient-text">
            {userName}，这是 AI 给你的初步画像
          </h3>
        </div>
        <div className="reading-content">
          <p className="text-night-100 leading-relaxed whitespace-pre-wrap">
            {summary}
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between text-xs text-night-400">
          <span>📌 免费摘要 · 300 字</span>
          <button
            onClick={handleCopy}
            className="text-mystic-300 hover:text-mystic-200 transition"
          >
            {copied ? "✓ 已复制" : "复制摘要"}
          </button>
        </div>
      </div>

      {/* 解锁完整版引导卡（核心钩子） */}
      {!fullText && !loading && (
        <div className="glass-card p-6 sm:p-8 border-mystic-500/40 relative overflow-hidden">
          {/* 背景光效 */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-mystic-500 rounded-full blur-3xl opacity-20" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500 rounded-full blur-3xl opacity-20" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🌟</span>
              <h3 className="text-lg font-semibold text-white">
                解锁 1500+ 字深度解读
              </h3>
            </div>
            <p className="text-sm text-night-200 mb-4 leading-relaxed">
              以上只是 AI 给你的<strong>初步画像</strong>。
              <br />
              <br />
              完整的深度解读，包含：
            </p>
            <ul className="space-y-2 text-sm text-night-100 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-mystic-400 mt-0.5">✓</span>
                <span>
                  <strong>现状画像</strong> - 透过表面看到你没意识到的层面
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-mystic-400 mt-0.5">✓</span>
                <span>
                  <strong>深层洞察</strong> - 你重复出现的心理模式与盲点
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-mystic-400 mt-0.5">✓</span>
                <span>
                  <strong>可执行建议</strong> - 3 条本周就能开始的小动作
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-mystic-400 mt-0.5">✓</span>
                <span>
                  <strong>温暖陪伴</strong> - AI 的私语，只给你看
                </span>
              </li>
            </ul>

            <button
              onClick={onRequestFull}
              className="btn-primary"
              disabled={loading}
            >
              🔓 立即生成完整解读（免费）
            </button>

            <div className="mt-4 p-4 bg-mystic-900/30 rounded-lg border border-mystic-500/30">
              <p className="text-xs text-night-300 text-center leading-relaxed">
                💡 <strong>提示</strong>：完整解读生成后，会附赠一份「专属解忧指南」
                <br />
                包含 30 天情绪跟踪 + 每周情绪急救包
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 完整解读（流式输出） */}
      {(fullText || loading) && (
        <div className="glass-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📜</span>
              <h3 className="text-lg font-semibold gradient-text">
                你的专属深度解读
              </h3>
            </div>
            {!loading && (
              <button
                onClick={handleShare}
                className="text-xs text-mystic-300 hover:text-mystic-200 transition"
              >
                分享给朋友
              </button>
            )}
          </div>

          <div
            ref={fullTextRef}
            className="reading-content max-h-[600px] overflow-y-auto pr-2"
          >
            <p className="whitespace-pre-wrap">
              {fullText}
              {loading && <span className="typing-cursor" />}
            </p>
          </div>

          {!loading && (
            <>
              {/* 微信引流卡（核心钩子） */}
              <div className="mt-8 p-6 bg-gradient-to-br from-mystic-900/40 to-pink-900/20 rounded-xl border border-mystic-500/30">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">💌</div>
                  <div className="flex-1">
                    <h4 className="text-base font-semibold text-white mb-2">
                      想要更深度的陪伴？
                    </h4>
                    <p className="text-sm text-night-200 leading-relaxed mb-4">
                      加我微信，我会：
                      <br />
                      ✓ 每月送你 1 份<strong>专属 AI 运势解读</strong>
                      <br />
                      ✓ 每周一次<strong>情绪急救包</strong>（30 秒治愈）
                      <br />
                      ✓ 优先体验<strong>新功能</strong>和<strong>定制服务</strong>
                    </p>
                    <div className="bg-night-900/60 rounded-lg p-3 mb-3 border border-mystic-500/20">
                      <p className="text-xs text-night-400 mb-1">我的微信号</p>
                      <p className="text-lg font-mono text-mystic-200 font-semibold">
                        {wechatId}
                      </p>
                    </div>
                    <p className="text-xs text-night-400">
                      📝 添加时备注「解读」，我会优先通过 ✨
                    </p>
                  </div>
                </div>
              </div>

              {/* 底部产品介绍钩子 */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="glass-card p-4 border-mystic-500/20">
                  <div className="text-2xl mb-2">📦</div>
                  <h5 className="text-sm font-semibold text-white mb-1">
                    进阶服务
                  </h5>
                  <p className="text-xs text-night-300 leading-relaxed">
                    AI 解读 + 定制手链 + 30 天陪伴，仅需 ¥498
                  </p>
                </div>
                <div className="glass-card p-4 border-mystic-500/20">
                  <div className="text-2xl mb-2">💎</div>
                  <h5 className="text-sm font-semibold text-white mb-1">
                    私人顾问
                  </h5>
                  <p className="text-xs text-night-300 leading-relaxed">
                    全年深度陪伴，¥9999，限 10 个名额
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}