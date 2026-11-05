"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/components/commerce/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatWon } from "@/lib/format";

/** 상품 사진이 없어서 선으로 그린다. 후방 카메라가 있는 구성은 후방 유닛을 함께 그린다. */
function DashCam({ rear = false }: { rear?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 360 190"
      fill="none"
      stroke="currentColor"
      className="block h-auto w-full border border-line bg-sunken text-ink"
    >
      <path className="opacity-30" strokeDasharray="3 5" d="M0 112H360M150 0V190" />
      {/* 거치대 */}
      <path d="M106 18H194V30H106ZM138 30V50H162V30" />
      {/* 본체 */}
      <path className="fill-raised" d="M70 56Q70 50 76 50H224Q230 50 230 56V166Q230 172 224 172H76Q70 172 70 166Z" />
      <path d="M82 158H112M82 150H112M82 142H112" />
      <circle cx="214" cy="66" r="3" className="fill-accent stroke-none" />
      {/* 렌즈 */}
      <circle cx="150" cy="112" r="44" className="fill-bg" />
      <circle cx="150" cy="112" r="32" />
      <circle cx="150" cy="112" r="20" className="stroke-accent" strokeWidth="2" />
      <circle cx="150" cy="112" r="7" className="fill-ink stroke-none" />
      {rear && (
        <>
          <path strokeDasharray="5 4" d="M230 150H262Q282 150 282 130V124" />
          <path className="fill-raised" d="M262 76H330V124H262Z" />
          <circle cx="296" cy="100" r="17" className="fill-bg" />
          <circle cx="296" cy="100" r="9" className="stroke-accent" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  return (
    <Card
      index={`0${index + 1}`}
      badge={<Badge tone="accent">판매 중</Badge>}
      title={product.name}
      href={`/products/${product.slug}`}
    >
      <p>{product.description}</p>
      <div className="mt-4">
        <DashCam rear={String(product.specs["구성"]).includes("후방 카메라")} />
      </div>
      <dl className="mt-4 border-t border-line">
        {Object.entries(product.specs).map(([term, value]) => (
          <div key={term} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2 border-b border-line py-2">
            <dt className="hud pt-0.5">{term}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 font-mono text-2xl font-semibold tracking-tight text-ink-strong">{formatWon(product.price)}</p>
    </Card>
  );
}

export function Products() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [failed, setFailed] = useState(false);

  // 공개 API라 토큰이 필요 없다. useApi를 쓰면 Clerk가 뜰 때까지 상품이 기다리게 된다.
  const load = useCallback(async (signal?: AbortSignal) => {
    setFailed(false);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/products`, { signal });
      if (!res.ok) throw new Error(String(res.status));
      const { items } = await res.json();
      if (!Array.isArray(items)) throw new Error("items 없음");
      setProducts(items);
    } catch {
      if (!signal?.aborted) setFailed(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <section id="products" aria-labelledby="products-title">
      <SectionLabel index="03" aside="토스 테스트 결제">
        상품
      </SectionLabel>
      <Reveal className="cells lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5 px-5 py-12 md:px-10 md:py-16">
          <h2
            id="products-title"
            className="text-3xl leading-tight font-extrabold tracking-[-0.03em] text-ink-strong md:text-5xl"
          >
            분석까지 이어지는 블랙박스
          </h2>
          <p className="max-w-sm text-muted">
            DashPi 블랙박스로 찍은 영상을 AIGO에 그대로 올려 레포트를 받습니다. 상품 상세에서 바로 구매하며, 테스트 결제라서 실제로 청구되지
            않습니다.
          </p>
        </div>

        {failed ? (
          <div className="flex flex-col gap-4 p-5 md:p-8">
            <div className="max-w-sm">
              <DashCam />
            </div>
            <Notice tone="danger">상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Notice>
            <Button variant="secondary" size="sm" onClick={() => load()}>
              다시 시도
            </Button>
          </div>
        ) : products === null ? (
          <div className="grid gap-5 p-5 sm:grid-cols-2 md:p-8">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : products.length === 0 ? (
          <p className="p-5 text-muted md:p-8">지금은 판매 중인 상품이 없습니다.</p>
        ) : (
          <div className="cells grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            {products.map((product, i) => (
              <ProductCard key={product.slug} product={product} index={i} />
            ))}
          </div>
        )}
      </Reveal>
    </section>
  );
}
