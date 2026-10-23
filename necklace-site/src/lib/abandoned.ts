import { getRedis } from "@/lib/redis";
import { getStripe } from "@/lib/stripe";
import { getProductById } from "@/lib/products";
import type Stripe from "stripe";
import {
  buildRecord,
  fetchSessionDetail,
  reasonJa,
  type AbandonedRecord,
  type PayAttempt,
} from "@/lib/abandoned-core";

// 「決済画面まで来て払わずに終わった」セッションの記録(止まった理由・進み具合)。
// 管理画面 /admin/abandoned だけが読む。個人情報(メール)を含むので公開ページ・ログには出さない。
const NS = "740nll:abandoned";
const INDEX_KEY = `${NS}:idx`; // sorted set: score = セッション作成時刻(ms)
const recKey = (sid: string) => `${NS}:rec:${sid}`;
const KEEP_SECONDS = 60 * 60 * 24 * 400;

export async function getAbandoned(sessionId: string): Promise<AbandonedRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<AbandonedRecord | string>(recKey(sessionId));
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as AbandonedRecord;
    } catch {
      return null;
    }
  }
  return raw;
}

export async function putAbandoned(rec: AbandonedRecord): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(recKey(rec.sessionId), JSON.stringify(rec), { ex: KEEP_SECONDS });
  await redis.zadd(INDEX_KEY, { score: rec.createdAt, member: rec.sessionId });
}

// 決済ページを作った瞬間の記録。端末・流入元はこの時にしか取れない。
// 失敗しても決済は止めない(呼び出し側で握りつぶす)。
export async function recordCheckoutStarted(input: {
  session: Stripe.Checkout.Session;
  device: AbandonedRecord["device"];
  referrer: string | undefined;
  productNames: Record<string, string>;
}): Promise<void> {
  const s = input.session;
  const detail = { session: s, intent: null, charges: [], productNames: input.productNames };
  const rec = buildRecord(detail, {});
  rec.outcome = "open";
  rec.source = "live";
  rec.cardOnlyInferred = false;
  rec.device = input.device;
  if (input.referrer) rec.referrer = input.referrer;
  await putAbandoned(rec);
}

// 決済ページの「戻る」で /checkout/cancel に帰ってきた印。
export async function markCheckoutBack(sessionId: string): Promise<void> {
  const rec = await getAbandoned(sessionId);
  if (!rec || rec.backAt) return;
  rec.backAt = Date.now();
  rec.updatedAt = Date.now();
  await putAbandoned(rec);
}

async function productNamesFor(summary: string | undefined): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const ids = new Set(
    (summary ?? "")
      .split(",")
      .map((p) => p.split(":")[0])
      .filter(Boolean),
  );
  await Promise.all(
    [...ids].map(async (id) => {
      try {
        const p = await getProductById(id);
        if (p) out[id] = `${p.name} — ${p.subtitle}`;
      } catch {
        // 商品名が取れなくても記録は続ける
      }
    }),
  );
  return out;
}

// Stripe の現在の状態から、このセッションの記録を作り直して保存する(Stripe は読むだけ)。
// 作成時に自前で記録した値(端末・流入元・戻る)は引き継ぐ。
export async function refreshFromStripe(
  session: Stripe.Checkout.Session,
  opts: { endedAt?: number; expiredByApi?: boolean } = {},
): Promise<AbandonedRecord> {
  const stripe = getStripe();
  const detail = await fetchSessionDetail(stripe, session);
  detail.productNames = await productNamesFor(session.metadata?.line_summary);
  const base = (await getAbandoned(session.id)) ?? undefined;
  const merged = {
    ...(base ?? {}),
    ...(opts.endedAt ? { endedAt: opts.endedAt } : {}),
    ...(opts.expiredByApi !== undefined ? { expiredByApi: opts.expiredByApi } : {}),
  } as Partial<AbandonedRecord>;
  if (base?.endedAt && !opts.endedAt) merged.endedAt = base.endedAt;
  const rec = buildRecord(detail, merged);
  await putAbandoned(rec);
  return rec;
}

// payment_intent.payment_failed を受けた時、支払いに失敗した1回分をそのセッションの記録へ足す。
// (期限切れまで待たなくても、成功に終わったセッションの途中失敗も残る)
export async function appendFailedAttempt(intent: Stripe.PaymentIntent): Promise<string | null> {
  const stripe = getStripe();
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: intent.id,
    limit: 1,
  });
  const session = sessions.data[0];
  if (!session) return null; // Checkout 以外の支払い
  const rec = await refreshFromStripe(session);
  // Charge が拾えていなくても、このイベントの失敗理由は必ず残す
  const e = intent.last_payment_error;
  if (e && !rec.attempts.some((a) => !a.ok)) {
    const code = e.decline_code ?? e.code ?? null;
    const attempt: PayAttempt = {
      at: Date.now(),
      method: e.payment_method?.type ?? "other",
      ok: false,
      code,
      message: e.message ?? null,
      reasonJa: reasonJa(code, e.message ?? null),
      riskLevel: null,
      outcomeType: null,
      cardBrand: e.payment_method?.card?.brand ?? null,
      cardFunding: e.payment_method?.card?.funding ?? null,
      cardCountry: e.payment_method?.card?.country ?? null,
      threeDS: null,
    };
    rec.attempts.push(attempt);
    rec.payMethod = attempt.method;
    await putAbandoned(rec);
  }
  return session.id;
}

export async function listAbandoned(limit = 300): Promise<AbandonedRecord[]> {
  const redis = getRedis();
  if (!redis) return [];
  const ids = await redis.zrange<string[]>(INDEX_KEY, 0, limit - 1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const raws = await redis.mget<(AbandonedRecord | string | null)[]>(...ids.map(recKey));
  const out: AbandonedRecord[] = [];
  for (const raw of raws) {
    if (!raw) continue;
    if (typeof raw === "string") {
      try {
        out.push(JSON.parse(raw) as AbandonedRecord);
      } catch {
        // 壊れた行は飛ばす
      }
    } else {
      out.push(raw);
    }
  }
  return out;
}

// 管理画面の「過去分を再取得」。Stripe の期限切れセッションを読み直して Redis に保存する。
// Stripe は読むだけ(list / retrieve)。1回の呼び出しで最大 maxSessions 件まで。
export async function backfillFromStripe(maxSessions = 120): Promise<{
  scanned: number;
  saved: number;
  hasMore: boolean;
}> {
  const stripe = getStripe();
  // 期限切れイベントは Stripe が30日分だけ持つ。ここから「いつ閉じたか」と
  // 「API で閉じた(戻るボタン等)か、期限で自動的に閉じたか」が分かる。
  const closed = new Map<string, { at: number; byApi: boolean }>();
  try {
    let n = 0;
    for await (const ev of stripe.events.list({
      type: "checkout.session.expired",
      limit: 100,
    })) {
      const sid = (ev.data.object as Stripe.Checkout.Session).id;
      closed.set(sid, { at: ev.created * 1000, byApi: Boolean(ev.request?.id) });
      if (++n >= 1000) break;
    }
  } catch (e) {
    console.error("[abandoned] events list failed:", e);
  }
  let scanned = 0;
  let saved = 0;
  let startingAfter: string | undefined;
  let hasMore = false;
  while (scanned < maxSessions) {
    const page = await stripe.checkout.sessions.list({
      status: "expired",
      limit: Math.min(50, maxSessions - scanned),
      expand: ["data.payment_intent"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const s of page.data) {
      scanned++;
      try {
        const ev = closed.get(s.id);
        await refreshFromStripe(s, {
          ...(ev ? { endedAt: ev.at, expiredByApi: ev.byApi } : {}),
        });
        saved++;
      } catch (e) {
        console.error(`[abandoned] backfill failed for ${s.id}:`, e);
      }
    }
    hasMore = page.has_more;
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return { scanned, saved, hasMore };
}
