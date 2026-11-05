/** API 응답 형태. 생성 타입(api.gen.ts)은 응답 본문을 담지 않아 쓰는 칸만 적는다. */
export type Product = {
  slug: string;
  name: string;
  description: string;
  price: number;
  specs: Record<string, unknown>;
  image_url: string | null;
};

export type Order = {
  id: number;
  toss_order_id: string;
  status: "pending" | "paid" | "failed";
  amount: number;
  order_name: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  recipient_name: string;
  phone: string;
  address: string;
  created_at: string;
  paid_at: string | null;
};

export const TEST_PAYMENT_NOTICE = "테스트 결제입니다. 실제로 청구되지 않습니다";
