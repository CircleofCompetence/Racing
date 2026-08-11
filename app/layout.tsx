import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MINI Racer",
  description: "빨간 미니 스포츠카로 장난감 장애물을 피하는 모바일 레이싱 게임",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
