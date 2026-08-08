import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3학년 시간표 자동 생성기",
  description: "이동수업/동시수업 선택 과목을 반영한 개인별 시간표 자동 생성 사이트",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
