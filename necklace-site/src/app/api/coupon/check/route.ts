import { NextResponse } from "next/server";
import { getProductById } from "@/lib/products";
import { getCouponView, parseCouponCode } from "@/lib/coupons";
import { calcDiscount, COUPON_KINDS, type DiscountLine } from "@/lib/coupon-kinds";
import { couponReasonMessage, couponWrongCartMessage } from "@/lib/coupon-messages";
import { checkoutLimiter, enforce, getClientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// カートの「適用」ボタン用。コードが使えるか・いくら引かれるかを返すだけで、予約はしない
// (予約は決済ページを作る /api/checkout が行う)。
export async function POST(req: Request) {
  const rl = await enforce(checkoutLimiter(), getClientIp(req));
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "リクエストが多すぎます。しばらく待ってから再度お試しください。" },
      { status: 429 },
    );
  }
  let body: { code?: unknown; lines?: { productId?: unknown; qty?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const code = parseCouponCode(body.code);
  if (!code) {
    return NextResponse.json(
      { ok: false, error: "クーポンコードの形式が正しくありません。もう一度ご確認ください。" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 40) {
    return NextResponse.json({ ok: false, error: "カートが空です" }, { status: 400 });
  }
  const lines: DiscountLine[] = [];
  for (const l of body.lines) {
    if (!l || typeof l.productId !== "string") continue;
    const qty = Math.min(99, Math.floor(Number(l.qty)));
    if (!Number.isFinite(qty) || qty < 1) continue;
    const p = await getProductById(l.productId);
    if (!p || p.published === false) continue;
    lines.push({ category: p.category, amount: p.price * qty });
  }

  let view;
  try {
    view = await getCouponView(code);
  } catch (e) {
    console.error("[coupon/check] failed:", e);
    return NextResponse.json({ ok: false, error: couponReasonMessage("unavailable") }, { status: 503 });
  }
  if (!view) {
    return NextResponse.json({ ok: false, error: couponReasonMessage("notfound") }, { status: 400 });
  }
  if (view.status === "used" || view.status === "disabled" || view.status === "reserved") {
    return NextResponse.json({ ok: false, error: couponReasonMessage(view.status) }, { status: 400 });
  }
  const { discount } = calcDiscount(view.kind, lines);
  if (discount <= 0) {
    return NextResponse.json({ ok: false, error: couponWrongCartMessage(view.kind) }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    code,
    discount,
    percentOff: COUPON_KINDS[view.kind].percentOff,
    only: COUPON_KINDS[view.kind].onlyFor,
  });
}
