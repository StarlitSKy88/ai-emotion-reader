import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "问心 AI · 情感解忧",
  description:
    "基于 AI 算法 + 心理学模型，为你生成深度个性化情感解读。随时在场，永不评判。",
  keywords: ["AI 情感解读", "情感咨询", "心理分析", "情绪解忧"],
  authors: [{ name: "问心 AI" }],
  openGraph: {
    title: "问心 AI · 情感解忧",
    description: "基于 AI 算法与心理学模型的情感解读。",
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
        <main>{children}</main>
      </body>
    </html>
  );
}