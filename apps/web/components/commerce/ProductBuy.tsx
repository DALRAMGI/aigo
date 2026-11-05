"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { formatWon } from "@/lib/format";
import { QuantityPicker } from "./QuantityPicker";

export function ProductBuy({ slug, price }: { slug: string; price: number }) {
  const [quantity, setQuantity] = useState(1);
  return (
    <div className="flex flex-col gap-4">
      <QuantityPicker value={quantity} onChange={setQuantity} />
      <p className="font-mono text-lg font-bold">{formatWon(price * quantity)}</p>
      <Link href={`/checkout?product=${encodeURIComponent(slug)}&quantity=${quantity}`} className={buttonClass({ size: "lg" })}>
        구매하기
      </Link>
    </div>
  );
}

/** 이미지 없이 코드로 그린 대시캠 자리 표시. */
export function ProductVisual() {
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="DashPi 블랙박스 도식" className="w-full border border-line bg-raised">
      <rect x="70" y="60" width="180" height="90" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="160" cy="105" r="26" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="160" cy="105" r="9" fill="var(--color-accent-ink, currentColor)" />
      <path d="M130 60 L160 40 L190 60" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="232" cy="76" r="3" fill="var(--color-danger, currentColor)" />
    </svg>
  );
}
