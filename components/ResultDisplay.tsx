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

  return (
    <div className="space-y-12 animate-fade-in">
      {/* 免费摘要 - 编辑感排版 */}
      <article className="border-t hairline pt-8">
        <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-6">
          初步画像 · 摘要
        </div>
        <div className="reading-content max-w-none">
          <p className="whitespace-pre-wrap text-balance">{summary}</p>
        </div>
        <div className="mt-8 pt-6 border-t hairline flex items-center justify-between text-sm text-ink-light">
          <span className="font-mono text-xs">— 来自问心 AI</span>
          <button
            onClick={handleCopy}
            className="text-ink-light hover:text-ink transition link-editor"
          >
            {copied ? "已复制" : "复制摘要"}
          </button>
        </div>
      </article>

      {/* 解锁完整版引导 - 编辑感深色块 */}
      {!fullText && !loading && (
        <section className="bg-deep text-paper rounded-2xl p-8 md:p-12">
          <div className="text-sm font-mono text-paper-300 uppercase tracking-wider mb-4 opacity-70">
            解锁完整解读
          </div>
          <h2 className="font-serif text-display-sm md:text-display-md mb-6 text-balance">
            以上只是 AI 给你的初步画像。
            <br />
            完整解读里还有：
          </h2>
          <ul className="space-y-4 mb-8 text-paper-100 text-base leading-relaxed">
            <li className="flex items-baseline gap-3">
              <span className="font-mono text-xs opacity-60">01</span>
              <span>
                <span className="font-serif text-paper text-lg block mb-1">现状画像</span>
                透过表面看到你没意识到的层面
              </span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="font-mono text-xs opacity-60">02</span>
              <span>
                <span className="font-serif text-paper text-lg block mb-1">深层洞察</span>
                你重复出现的心理模式与盲点
              </span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="font-mono text-xs opacity-60">03</span>
              <span>
                <span className="font-serif text-paper text-lg block mb-1">可执行建议</span>
                3 条本周就能开始的小动作
              </span>
            </li>
            <li className="flex items-baseline gap-3">
              <span className="font-mono text-xs opacity-60">04</span>
              <span>
                <span className="font-serif text-paper text-lg block mb-1">温暖陪伴</span>
                AI 的私语，只给你看
              </span>
            </li>
          </ul>
          <button
            onClick={onRequestFull}
            className="bg-paper text-ink hover:bg-paper-200 transition px-8 py-3 rounded-full font-medium text-sm"
            disabled={loading}
          >
            生成完整解读 →
          </button>
        </section>
      )}

      {/* 完整解读 - 流式输出 */}
      {(fullText || loading) && (
        <article className="border-t hairline pt-8">
          <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-6">
            完整解读 · {userName}的专属报告
          </div>
          <div
            ref={fullTextRef}
            className="reading-content max-h-[700px] overflow-y-auto pr-4"
          >
            <p className="whitespace-pre-wrap text-balance">
              {fullText}
              {loading && <span className="typing-cursor" />}
            </p>
          </div>

          {!loading && (
            <>
              {/* 微信引流 - 编辑感布局 */}
              <aside className="mt-16 pt-8 border-t hairline">
                <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-6">
                  持续陪伴
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-start">
                  <div>
                    <h3 className="font-serif text-2xl mb-4 text-balance">
                      想要更长期的陪伴？
                    </h3>
                    <p className="text-ink-light leading-relaxed mb-6">
                      加我微信，我会每月送你 1 份专属 AI 运势解读，每周一次情绪急救包，
                      优先体验新功能。
                    </p>
                    <p className="text-sm text-ink-light">
                      添加时备注「解读」，我会优先通过。
                    </p>
                  </div>
                  <div className="bg-paper-200 rounded-xl p-6 md:min-w-[200px]">
                    <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-2">
                      微信号
                    </div>
                    <div className="font-mono text-xl text-ink font-medium break-all">
                      {wechatId}
                    </div>
                  </div>
                </div>
              </aside>

              {/* 进阶服务 - 编辑感卡片 */}
              <section className="mt-16 pt-8 border-t hairline">
                <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-6">
                  进阶服务
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border hairline rounded-xl p-6">
                    <div className="font-mono text-xs text-ink-light mb-2">套餐 A</div>
                    <h4 className="font-serif text-xl mb-2">解读 + 定制手链</h4>
                    <p className="text-sm text-ink-light leading-relaxed mb-4">
                      AI 解读 + 定制手链 + 30 天陪伴
                    </p>
                    <div className="font-serif text-2xl">¥498</div>
                  </div>
                  <div className="border hairline rounded-xl p-6">
                    <div className="font-mono text-xs text-ink-light mb-2">套餐 B</div>
                    <h4 className="font-serif text-xl mb-2">私人顾问</h4>
                    <p className="text-sm text-ink-light leading-relaxed mb-4">
                      全年深度陪伴，多款定制手链，限 10 个名额
                    </p>
                    <div className="font-serif text-2xl">¥9999</div>
                  </div>
                </div>
              </section>
            </>
          )}
        </article>
      )}
    </div>
  );
}