import { randomInt } from "node:crypto";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

// 今は 30% オフ固定。将来 UI で選べるように、割引率は常に引数で受け取る。
export const DEFAULT_PERCENT_OFF = 30;

// この管理画面から発行した Promotion Code の印。Stripe 側に他のコードがあっても混ざらない。
const SOURCE_KEY = "source";
const SOURCE_VALUE = "740nll-admin";
const NOTE_MAX = 200;

// 紛らわしい 0/O/1/I/L を除いた英数大文字(31 種)。口頭・DM で伝えやすい。
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_PREFIX = "740-";

export function isValidPercent(p: unknown): p is number {
  return typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= 100;
}

export function couponIdFor(percentOff: number): string {
  return `740nll-pct-${percentOff}`;
}

export function generateCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${CODE_PREFIX}${s}`;
}

// 割引率ごとに Coupon 本体を 1 つ使い回す(ID 固定)。無ければ作る。
// 割引は商品代だけにかかる(Checkout は送料(shipping_options)を割引対象にしない)。
async function ensureCoupon(percentOff: number): Promise<string> {
  const stripe = getStripe();
  const id = couponIdFor(percentOff);
  try {
    const existing = await stripe.coupons.retrieve(id);
    if (!existing.deleted) return id;
  } catch (e) {
    if (!isStripeError(e, "resource_missing")) throw e;
  }
  try {
    await stripe.coupons.create({
      id,
      name: `740NLL ${percentOff}%オフ`,
      percent_off: percentOff,
      duration: "once",
      metadata: { [SOURCE_KEY]: SOURCE_VALUE },
    });
  } catch (e) {
    // 同時発行で先に作られた場合はそのまま使う
    if (!isStripeError(e, "resource_already_exists")) throw e;
  }
  return id;
}

function isStripeError(e: unknown, code: string): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: string }).code === code
  );
}

export type CouponView = {
  id: string;
  code: string;
  note: string;
  percentOff: number | null;
  createdAt: number;
  status: "unused" | "used" | "disabled";
  redeemedAt: number | null;
};

function toView(p: Stripe.PromotionCode): CouponView {
  const coupon = p.promotion.coupon;
  const percentOff =
    coupon && typeof coupon === "object" ? (coupon.percent_off ?? null) : null;
  const redeemedRaw = p.metadata?.redeemed_at;
  const redeemedAt = redeemedRaw ? Number(redeemedRaw) : null;
  return {
    id: p.id,
    code: p.code,
    note: p.metadata?.note ?? "",
    percentOff,
    createdAt: p.created * 1000,
    status:
      p.times_redeemed > 0 ? "used" : p.active ? "unused" : "disabled",
    redeemedAt: redeemedAt && Number.isFinite(redeemedAt) ? redeemedAt : null,
  };
}

export async function issueCoupon(input: {
  percentOff?: number;
  note?: string;
  issuedBy?: string;
}): Promise<CouponView> {
  const percentOff = input.percentOff ?? DEFAULT_PERCENT_OFF;
  if (!isValidPercent(percentOff)) throw new Error("invalid percent");
  const note = (input.note ?? "").trim().slice(0, NOTE_MAX);
  const stripe = getStripe();
  const couponId = await ensureCoupon(percentOff);

  const metadata: Record<string, string> = { [SOURCE_KEY]: SOURCE_VALUE };
  if (note) metadata.note = note;
  if (input.issuedBy) metadata.issued_by = input.issuedBy.slice(0, 100);

  // コードが偶然かぶったら引き直す(31^6 なのでまず起きない)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: couponId },
        code: generateCode(),
        max_redemptions: 1,
        metadata,
        expand: ["promotion.coupon"],
      });
      return toView(created);
    } catch (e) {
      if (isStripeError(e, "resource_already_exists") && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("could not generate a unique code");
}

export async function listCoupons(limit = 100): Promise<CouponView[]> {
  const stripe = getStripe();
  const res = await stripe.promotionCodes.list({
    limit,
    expand: ["data.promotion.coupon"],
  });
  return res.data
    .filter((p) => p.metadata?.[SOURCE_KEY] === SOURCE_VALUE)
    .map(toView)
    .sort((a, b) => b.createdAt - a.createdAt);
}

// 未使用のコードを無効にする。使用済み・他所で作られたコードには触らない。
export async function disableCoupon(
  promotionCodeId: string,
): Promise<"ok" | "not_found" | "already_used"> {
  const stripe = getStripe();
  let p: Stripe.PromotionCode;
  try {
    p = await stripe.promotionCodes.retrieve(promotionCodeId);
  } catch (e) {
    if (isStripeError(e, "resource_missing")) return "not_found";
    throw e;
  }
  if (p.metadata?.[SOURCE_KEY] !== SOURCE_VALUE) return "not_found";
  if (p.times_redeemed > 0) return "already_used";
  await stripe.promotionCodes.update(promotionCodeId, { active: false });
  return "ok";
}

export type OrderDiscount = {
  code: string | null;
  amount: number;
};

// 決済済みセッションで使われたクーポンを読む。使われていなければ null。
// コードが管理画面発行のものなら、使われた日時をその Promotion Code に残す(一覧の「使われた日」用)。
export async function resolveSessionDiscount(
  session: Stripe.Checkout.Session,
): Promise<OrderDiscount | null> {
  const amount = session.total_details?.amount_discount ?? 0;
  if (amount <= 0) return null;
  const stripe = getStripe();
  let code: string | null = null;
  try {
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["total_details.breakdown"],
    });
    // Session.discounts が正式な置き場。型定義が古い版の breakdown にも念のため当たる。
    const fromSession = full.discounts?.[0]?.promotion_code;
    const fromBreakdown = (
      full.total_details?.breakdown?.discounts?.[0]?.discount as
        | { promotion_code?: string | { id: string } | null }
        | undefined
    )?.promotion_code;
    const promoRef = fromSession ?? fromBreakdown;
    const promoId = typeof promoRef === "string" ? promoRef : promoRef?.id;
    if (promoId) {
      const p = await stripe.promotionCodes.retrieve(promoId);
      code = p.code;
      if (p.metadata?.[SOURCE_KEY] === SOURCE_VALUE && !p.metadata.redeemed_at) {
        await stripe.promotionCodes.update(promoId, {
          metadata: {
            redeemed_at: String(Date.now()),
            redeemed_session: session.id,
          },
        });
      }
    }
  } catch (e) {
    // 表示用の補助情報。取れなくても注文処理は止めない。
    console.error(`[coupons] discount lookup failed for ${session.id}:`, e);
  }
  return { code, amount };
}
