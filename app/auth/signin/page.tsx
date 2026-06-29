"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await signIn("email", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/",
      });
      if (result?.ok) {
        setSent(true);
      } else {
        alert("发送失败，请检查邮箱地址");
      }
    } catch (err) {
      alert("发送出错：" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center">
          <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-4">
            登录
          </div>
          <h1 className="font-serif text-display-sm mb-6 text-balance">
            登录链接已发送
          </h1>
          <p className="text-ink-light leading-relaxed mb-8">
            请检查您的邮箱 <strong>{email}</strong>，点击邮件中的链接登录。
            <br />
            <span className="text-sm">链接 24 小时内有效。</span>
          </p>
          <button
            onClick={() => setSent(false)}
            className="link-editor text-ink-light text-sm"
          >
            ← 换一个邮箱
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-3">
            登录 / 注册
          </div>
          <h1 className="font-serif text-display-sm mb-3">
            欢迎回到 问心 AI
          </h1>
          <p className="text-ink-light">
            输入您的邮箱，我们会发送一个登录链接。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              邮箱地址
            </label>
            <input
              type="email"
              required
              autoFocus
              className="input-editor"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-editor w-full justify-center"
            disabled={loading}
          >
            {loading ? "发送中…" : "发送登录链接 →"}
          </button>
        </form>

        <p className="text-xs text-ink-muted text-center mt-8">
          我们不会向第三方分享您的邮箱。
        </p>
      </div>
    </main>
  );
}