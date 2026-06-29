"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyPage() {
  const router = useRouter();

  useEffect(() => {
    // 自动跳转回首页
    const timer = setTimeout(() => {
      router.push("/");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="text-sm font-mono text-ink-light uppercase tracking-wider mb-3">
          验证邮箱
        </div>
        <h1 className="font-serif text-display-sm mb-4">
          请检查您的邮箱
        </h1>
        <p className="text-ink-light leading-relaxed mb-8">
          我们刚刚向您的邮箱发送了一封登录邮件。
          <br />
          点击邮件中的链接即可完成登录。
        </p>
        <p className="text-sm text-ink-muted">
          3 秒后自动跳转…
        </p>
      </div>
    </main>
  );
}