"use client";

import { HandleSSOCallback } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { navigateTo, takeRedirect } from "@/components/auth/redirect";

// 소셜 로그인에서 돌아오는 곳. 화면은 비워 두고 상태에 따라 알맞은 곳으로 보낸다.
export default function SsoCallbackPage() {
  const router = useRouter();
  return (
    <main className="grid min-h-screen place-items-center">
      <p className="hud text-muted">로그인 확인 중</p>
      <HandleSSOCallback
        navigateToApp={navigateTo(router.push, takeRedirect())}
        navigateToSignIn={() => router.push("/login")}
        navigateToSignUp={() => router.push("/signup")}
      />
    </main>
  );
}
