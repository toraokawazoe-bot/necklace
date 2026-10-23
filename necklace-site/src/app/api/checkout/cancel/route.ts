import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { releaseCoupon } from "@/lib/coupons";
import { markCheckoutBack } from "@/lib/abandoned";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 決済ページから「戻る」で帰ってきた時、予約中のクーポンをすぐ未使用に戻す。
// セッション ID は決済した本人のブラウザしか持たない。未払いのセッションだけを閉じる。
export async function POST(req: Request) {
  let sessionId = "";
  try {
    const b = (await req.json()) as { sessionId?: unknown };
    sessionId = typeof b.sessionId === "string" ? b.sessionId : "";
  } catch {
    // fallthrough
  }
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // 「戻るボタンで中断した」印。期限切れの理由を区別するために残す(失敗しても処理は続ける)。
    if (session.status !== "complete") {
      await markCheckoutBack(sessionId).catch((e) =>
        console.error("[checkout/cancel] mark back failed:", e),
      );
    }
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(sessionId);
    }
    if (session.status !== "complete") {
      const code = session.metadata?.coupon_code;
      const token = session.metadata?.coupon_token;
      if (code && token) await releaseCoupon(code, token);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[checkout/cancel] failed:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
