import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "问心 AI - 你的专属情感解忧师",
  description:
    "24小时在线的 AI 情感咨询师。基于 AI 算法 + 心理学模型，为你生成深度个性化解读报告。",
  keywords: ["AI情感解读", "情感咨询", "心理分析", "情绪解忧", "AI树洞"],
  authors: [{ name: "问心先生" }],
  openGraph: {
    title: "问心 AI - 你的专属情感解忧师",
    description: "24小时在线的 AI 情感咨询师。温暖、共情、永不评判。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="starfield" />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}