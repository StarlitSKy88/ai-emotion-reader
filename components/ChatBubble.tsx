"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatBubbleProps {
  messages: Message[];
  onSend: (content: string) => Promise<void>;
  loading: boolean;
}

export default function ChatBubble({ messages, onSend, loading }: ChatBubbleProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");
    await onSend(content);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 space-y-8">
        {messages.length === 0 && (
          <div className="text-center py-20">
            <p className="text-ink-light text-sm font-mono">
              开始你的对话...
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={msg.id || idx}
            className={`flex animate-fade-up ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-2xl ${
                msg.role === "user"
                  ? "bg-ink text-paper rounded-2xl rounded-tr-sm px-5 py-3"
                  : "text-ink"
              }`}
            >
              <div className="text-xs font-mono uppercase tracking-wider mb-2 opacity-60">
                {msg.role === "user" ? "你" : "问心 AI"}
              </div>
              <div
                className={`leading-relaxed text-pretty whitespace-pre-wrap ${
                  msg.role === "user" ? "text-paper" : "reading-content"
                }`}
              >
                {msg.content || (
                  <span className="typing-cursor text-ink-light">AI 正在思考</span>
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="border-t hairline px-4 md:px-8 py-6 bg-paper-100/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              placeholder="继续对话..."
              rows={1}
              disabled={loading}
              className="input-editor flex-1 resize-none max-h-32 min-h-[48px] py-3"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="btn-editor h-12 px-6 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  发送中
                </>
              ) : (
                <>发送 →</>
              )}
            </button>
          </div>
          <p className="text-xs text-ink-light mt-3 text-center">
            按 Enter 发送 · Shift+Enter 换行
          </p>
        </form>
      </div>
    </div>
  );
}