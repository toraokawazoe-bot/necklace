import { NextResponse } from "next/server";
import { recordOrder, type StoredOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETUP_TOKEN = "setup_8f3kl29sdfk0fjlfd";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== SETUP_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const stored: StoredOrder = {
    sessionId: `cs_test_seed_${Date.now()}`,
    status: "paid",
    createdAt: Date.now(),
    amountTotal: 200,
    currency: "jpy",
    email: "test@example.com",
    customerName: "テスト 太郎",
    items: [
      { name: "テスト商品 (シードデータ)", qty: 1, amountTotal: 50 },
      { name: "全国一律送料", qty: 1, amountTotal: 150 },
    ],
    paymentMethod: "クレジットカード",
    shippingSummary: "〒0000000 東京都テスト区 1-2-3",
  };

  await recordOrder(stored);
  return NextResponse.json({ ok: true, sessionId: stored.sessionId });
}
