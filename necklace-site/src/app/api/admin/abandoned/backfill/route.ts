import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { backfillFromStripe } from "@/lib/abandoned";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 管理者だけが押せる「過去分を再取得」。Stripe の期限切れセッションを読み直して Redis に保存する。
// Stripe には何も書かない(list / retrieve のみ)。
export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await backfillFromStripe(120);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[admin/abandoned/backfill] failed:", e);
    return NextResponse.json(
      { error: "Stripe から読み込めませんでした。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
