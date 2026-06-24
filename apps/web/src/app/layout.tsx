import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofLoop - AI 反馈分析引擎",
  description: "AI 产品反馈报告，包含证据追踪与语义校验",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="light">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-background text-on-background font-body-md">
        {children}
      </body>
    </html>
  );
}
