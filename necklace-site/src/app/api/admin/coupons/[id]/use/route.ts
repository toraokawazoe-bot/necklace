import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { getCouponView, markCouponUsedByOrder, parseCouponCode } from "@/lib/coupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 「オーダー(Instagram DM)で使用済みにする」。未使用のものだけ。元に戻せない。
export async function POST(
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
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    const result = await markCouponUsedByOrder(code, session.email);
    if (result === "not_found") {
      return NextResponse.json({ error: "クーポンが見つかりません" }, { status: 404 });
    }
    if (result === "reserved") {
      return NextResponse.json(
        { error: "ECの決済の手続き中です。終わるまで（最大40分）使用済みにできません" },
        { status: 409 },
      );
    }
    if (result === "used") {
      return NextResponse.json({ error: "すでに使用済みです" }, { status: 409 });
    }
    if (result === "disabled") {
      return NextResponse.json({ error: "無効になっているクーポンです" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, coupon: await getCouponView(code) });
  } catch (e) {
    console.error("[coupons] order-use failed:", e);
    return NextResponse.json({ error: "使用済みにできませんでした" }, { status: 500 });
  }
}
