"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DESIGN_COOKIE, DESIGN_MAX_AGE, parseDesign, type Design } from "@/lib/design";

export function DesignToggle({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [design, setDesign] = useState<Design>("classic");

  // 서버가 html에 내려 준 값을 따른다.
  useEffect(() => setDesign(parseDesign(document.documentElement.dataset.design) ?? "classic"), []);

  const toggle = () => {
    const next: Design = design === "poster" ? "classic" : "poster";
    document.cookie = `${DESIGN_COOKIE}=${next}; path=/; max-age=${DESIGN_MAX_AGE}; samesite=lax`;
    setDesign(next);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={design === "poster" ? "기본 디자인으로 전환" : "포스터 디자인으로 전환"}
      className={className}
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M1.7 1.7h9v9h-9z" />
        <path d="M13.3 5.3h1v9h-9v-1" />
        <path fill="currentColor" stroke="none" d="M1.7 10.7 10.7 1.7v9z" />
      </svg>
    </button>
  );
}
