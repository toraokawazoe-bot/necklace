import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { disableCoupon, getCouponView, parseCouponCode } from "@/lib/coupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// コード検索(DM で受け取ったコード。ゆれは parseCouponCode が吸収)。
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const code = parseCouponCode(decodeURIComponent(id));
  if (!code) {
    return NextResponse.json({ error: "コードの形が違います" }, { status: 400 });
  }
  try {
    const coupon = await getCouponView(code);
    if (!coupon) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json({ coupon });
  } catch (e) {
    console.error("[coupons] lookup failed:", e);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}

// クーポンを無効にする(未使用のものだけ)。
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const code = parseCouponCode(id);
  if (!code) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const result = await disableCoupon(code);
    if (result === "reserved") {
      return NextResponse.json({ error: "決済の手続き中のため、いまは無効にできません" }, { status: 409 });
    }
    if (result === "not_found") {
      return NextResponse.json({ error: "クーポンが見つかりません" }, { status: 404 });
    }
    if (result === "already_used") {
      return NextResponse.json({ error: "使用済みのクーポンは無効にできません" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[coupons] disable failed:", e);
    return NextResponse.json({ error: "無効化に失敗しました" }, { status: 500 });
  }
}
