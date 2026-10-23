import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { allowNewLineCoupon, findLineCoupon, issueLineCoupon } from "@/lib/coupons";
import { getRedis } from "@/lib/redis";
import { getClientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEVICE_COOKIE = "nll_dev";
const UID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// LINE のあいさつメッセージのリンク先。開いた人に necklace10(ネックレス 10%オフ)を 1 枚だけ渡す。
//  - エルメが友だちごとの値を URL に差し込めれば uid で 1 人 1 枚。無ければ端末の Cookie で同じ端末には同じコード。
//  - uid も Cookie も付け替えられるので、乱発は IP ごとの発行回数制限で抑える(再表示は数えない)。
//  - ページを開いただけ(リンクのプレビュー等)では発行せず、画面から POST された時だけ発行する。
export async function POST(req: Request) {
  if (!getRedis()) {
    return NextResponse.json(
      { error: "ただいまクーポンを発行できません。時間をおいてもう一度お試しください。" },
      { status: 503 },
    );
  }
  let uid: string | null = null;
  try {
    const b = (await req.json()) as { uid?: unknown };
    if (typeof b.uid === "string" && UID_PATTERN.test(b.uid)) uid = b.uid;
  } catch {
    // 本文なしでも受け付ける
  }
  const existingDev = readCookie(req, DEVICE_COOKIE);
  const deviceId =
    existingDev && /^d_[0-9a-f-]{36}$/.test(existingDev) ? existingDev : `d_${randomUUID()}`;

  try {
    const input = { uid, deviceId };
    let coupon = await findLineCoupon(input);
    let created = false;
    if (!coupon) {
      if (!(await allowNewLineCoupon(getClientIp(req)))) {
        return NextResponse.json(
          { error: "短い時間にたくさんの発行がありました。しばらく待ってからもう一度お試しください。" },
          { status: 429 },
        );
      }
      const res = await issueLineCoupon(input);
      coupon = res.coupon;
      created = res.created;
    }
    const out = NextResponse.json({
      code: coupon.code,
      status: coupon.status,
      created,
    });
    out.cookies.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
    });
    return out;
  } catch (e) {
    console.error("[coupon/line] failed:", e);
    return NextResponse.json(
      { error: "クーポンの発行に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
