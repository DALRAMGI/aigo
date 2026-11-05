"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { CodeForm } from "./CodeForm";
import { navigateTo, safeRedirect } from "./redirect";
import { SocialButtons } from "./SocialButtons";
import { useAction } from "./useAction";

export const PASSWORD_HINT = "15자 이상으로 정해 주세요. 길수록 안전합니다.";

export function SignupForm({ redirectUrl }: { redirectUrl?: string }) {
  const dest = safeRedirect(redirectUrl);
  const router = useRouter();
  const { signUp } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<"form" | "code">("form");
  const create = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    await create.run(async () => {
      const made = await signUp.password({ emailAddress: email, password });
      if (made.error) return made;
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) return sent;
      setPhase("code");
    });
  }

  if (phase === "code") {
    return (
      <CodeForm
        email={email}
        backLabel="이메일 다시 입력"
        onVerify={async (code) => {
          const { error } = await signUp.verifications.verifyEmailCode({ code });
          if (error) return { error };
          if (signUp.status !== "complete") throw new Error(`incomplete: ${signUp.status}`);
          return signUp.finalize({ navigate: navigateTo(router.push, dest) });
        }}
        onResend={() => signUp.verifications.sendEmailCode()}
        onBack={async () => {
          await signUp.reset();
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
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          minLength={15}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {create.error && <Notice tone="danger">{create.error}</Notice>}
        <div id="clerk-captcha" />
        <Button type="submit" size="lg" full loading={create.pending}>
          가입하기
        </Button>
      </form>
      <p className="text-[13px] text-muted">
        이미 계정이 있나요?{" "}
        <Link href={`/login${dest === "/" ? "" : `?redirect_url=${encodeURIComponent(dest)}`}`} className="font-semibold text-ink underline underline-offset-4">
          로그인
        </Link>
      </p>
      <p className="hud text-muted">또는</p>
      <SocialButtons redirectUrl={dest} />
    </>
  );
}
