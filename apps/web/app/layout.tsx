import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "DashPi",
  description: "사고를 판정하는 AI가 아니라 사고 대응력을 높이는 AI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={GeistMono.variable}>
      <body>
        <ClerkProvider signInUrl="/login" signUpUrl="/signup">
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
