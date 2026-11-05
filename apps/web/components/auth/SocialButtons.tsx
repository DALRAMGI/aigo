"use client";

import { useSignIn } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { rememberRedirect } from "./redirect";
import { useAction } from "./useAction";

const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;

// 켜 둔 공급자만, 이 순서로 보인다.
const PROVIDERS: { strategy: "oauth_google" | "oauth_apple" | "oauth_facebook"; label: string; icon: ReactNode }[] = [
  {
    strategy: "oauth_google",
    label: "Google로 계속하기",
    icon: (
      <svg aria-hidden {...ICON}>
        <path d="M20 12h-8M20 12a8 8 0 1 1-2.4-5.7" />
      </svg>
    ),
  },
  {
    strategy: "oauth_apple",
    label: "Apple로 계속하기",
    icon: (
      <svg aria-hidden {...ICON}>
        <path d="M12 8c1.5-1.5 5-1 5 3.5 0 4-2.5 8-5 8s-5-4-5-8C7 7 10.5 6.5 12 8ZM12 7c0-2 1-3.5 2.5-4" />
      </svg>
    ),
  },
  {
    strategy: "oauth_facebook",
    label: "Facebook으로 계속하기",
    icon: (
      <svg aria-hidden {...ICON}>
        <path d="M14 21v-8h3l.5-3H14V8c0-1 .5-2 2-2h1.5V3.5C17 3.4 16 3.3 15 3.3c-2.5 0-4 1.5-4 4V10H8v3h3v8" />
      </svg>
    ),
  },
];

/** 로그인과 가입 화면에서 같이 쓴다. 처음 보는 계정은 콜백에서 가입으로 이어진다. */
export function SocialButtons({ redirectUrl }: { redirectUrl: string }) {
  const { signIn } = useSignIn();
  const { pending, error, run } = useAction();

  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map(({ strategy, label, icon }) => (
        <Button
          key={strategy}
          variant="secondary"
          size="lg"
          full
          disabled={pending}
          onClick={() => {
            rememberRedirect(redirectUrl);
            return run(() => signIn.sso({ strategy, redirectCallbackUrl: "/sso-callback", redirectUrl }));
          }}
        >
          {icon}
          {label}
        </Button>
      ))}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
