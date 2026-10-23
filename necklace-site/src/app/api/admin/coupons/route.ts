import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { issueAdminCoupon, listCoupons } from "@/lib/coupons";
import { couponLimiter, enforce } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ coupons: await listCoupons() });
  } catch (e) {
    console.error("[coupons] list failed:", e);
    return NextResponse.json({ error: "一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rl = await enforce(couponLimiter(), session.email);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "発行が多すぎます。しばらく待ってからもう一度お試しください。" },
      { status: 429 },
    );
  }

  let body: { note?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // 本文なしでも発行できる(メモは任意)
  }
  if (body.note != null && typeof body.note !== "string") {
    return NextResponse.json({ error: "invalid note" }, { status: 400 });
  }

  try {
    const coupon = await issueAdminCoupon({
      note: body.note as string | undefined,
      issuedBy: session.email,
    });
    return NextResponse.json({ coupon });
  } catch (e) {
    console.error("[coupons] issue failed:", e);
    return NextResponse.json(
      { error: "クーポンの発行に失敗しました。もう一度お試しください。" },
      { status: 500 },
    );
  }
}
