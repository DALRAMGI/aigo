"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { CodeForm } from "./CodeForm";
import { navigateTo, safeRedirect } from "./redirect";
import { SocialButtons } from "./SocialButtons";
import { useAction } from "./useAction";

export function LoginForm({ redirectUrl }: { redirectUrl?: string }) {
  const dest = safeRedirect(redirectUrl);
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<"form" | "code">("form");
  const login = useAction();

  useEffect(() => {
    if (isSignedIn) router.replace(dest);
  }, [isSignedIn, dest, router]);

  const finish = () => signIn.finalize({ navigate: navigateTo(router.push, dest) });

  async function submit(e: FormEvent) {
    e.preventDefault();
    await login.run(async () => {
      const { error } = await signIn.password({ emailAddress: email, password });
      if (error) return { error };
      if (signIn.status === "complete") return finish();
      // 새 기기(needs_client_trust)와 2단계 인증은 이메일 코드로 확인한다.
      if (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") {
        if (!signIn.supportedSecondFactors.some((f) => f.strategy === "email_code")) throw new Error("unsupported factor");
        const sent = await signIn.mfa.sendEmailCode();
        if (sent.error) return sent;
        setPhase("code");
        return;
      }
      throw new Error(`incomplete: ${signIn.status}`);
    });
  }

  if (phase === "code") {
    return (
      <CodeForm
        email={email}
        backLabel="처음부터 다시"
        onVerify={async (code) => {
          const { error } = await signIn.mfa.verifyEmailCode({ code });
          if (error) return { error };
          if (signIn.status !== "complete") throw new Error(`incomplete: ${signIn.status}`);
          return finish();
        }}
        onResend={() => signIn.mfa.sendEmailCode()}
        onBack={async () => {
          await signIn.reset();
          setPhase("form");
        }}
      />
    );
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="이메일" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {login.error && <Notice tone="danger">{login.error}</Notice>}
        <Button type="submit" size="lg" full loading={login.pending}>
          로그인
        </Button>
      </form>
      <div className="flex justify-between text-[13px]">
        <Link href="/forgot-password" className="text-muted underline underline-offset-4">
          비밀번호를 잊으셨나요?
        </Link>
        <Link href={`/signup${dest === "/" ? "" : `?redirect_url=${encodeURIComponent(dest)}`}`} className="font-semibold underline underline-offset-4">
          회원가입
        </Link>
      </div>
      <p className="hud text-muted">또는</p>
      <SocialButtons redirectUrl={dest} />
    </>
  );
}
