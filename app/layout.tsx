import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css"; // 這行非常重要，它是載入漂亮背景和樣式的關鍵！

// 載入 Google 字體
const notoSans = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "ZenStudy 沉浸式自習室",
  description: "一段專屬於你的沉浸式專注時光",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className={notoSans.className}>{children}</body>
    </html>
  );
}
