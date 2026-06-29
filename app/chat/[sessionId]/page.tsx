"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatBubble from "@/components/ChatBubble";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [streamingContent, setStreamingContent] = useState("");

  // 加载会话历史
  useEffect(() => {
    loadSession();
  }, [sessionId]);

  async function loadSession() {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      if (data.session?.messages) {
        setMessages(data.session.messages);
      }
    } catch (err) {
      console.error("加载会话失败", err);
    } finally {
      setInitialLoading(false);
    }
  }

  async function handleSend(content: string) {
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setStreamingContent("");

    try {
      // 临时用一个 userId（MVP 阶段，后续接入 NextAuth）
      const tempUserId = "guest-user";

      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: tempUserId,
          content,
        }),
      });

      if (!res.ok) throw new Error("发送失败");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      // 添加一个空的 AI 消息占位
      const aiMsgId = `temp-ai-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        },
      ]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          // 更新最后一条 AI 消息的内容
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: accumulated } : m,
            ),
          );
          setStreamingContent(accumulated);
        }
      }
    } catch (err) {
      console.error("发送失败", err);
      alert("发送失败，请重试");
    } finally {
      setLoading(false);
      setStreamingContent("");
    }
  }

  if (initialLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-ink-light text-sm font-mono">加载中...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b hairline">
        <div className="container-editor-wide flex items-center justify-between py-4">
          <button
            onClick={() => router.push("/")}
            className="font-serif text-lg font-medium tracking-tight hover:opacity-70 transition"
          >
            问心 AI
          </button>
          <div className="text-sm text-ink-light">
            对话 · {messages.length} 条消息
          </div>
        </div>
      </header>

      {/* 对话区 */}
      <div className="flex-1 max-w-3xl mx-auto w-full">
        <ChatBubble
          messages={messages}
          onSend={handleSend}
          loading={loading}
        />
      </div>
    </main>
  );
}