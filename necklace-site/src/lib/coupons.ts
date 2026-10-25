import { randomInt } from "node:crypto";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getRedis } from "@/lib/redis";
import {
  COUPON_CODE_PATTERN,
  COUPON_KINDS,
  GENERAL30_PERCENT,
  isCouponKind,
  normalizeCouponCode,
  type CouponKind,
} from "@/lib/coupon-kinds";

// ---------------------------------------------------------------------------
// クーポンの保存先は Redis(既存の Upstash)を正とする。
//  - 種類(general30 / necklace10 / bracelet30)ごとに対象カテゴリが違い、Stripe の Promotion Code では
//    商品ごとの制限ができない(Checkout の line_items が price_data のその場作成のため)。
//  - 「未使用 → 予約中 → 使用済み」の状態を、Lua を使わず SET NX だけで原子的に動かす:
//      lock キー  : SET NX EX で取れた 1 人だけが予約できる(期限が来れば自然に未使用へ戻る)
//      used キー  : SET NX。付けるのは次の 2 つだけ。
//                   ・支払い確定 Webhook(via: "ec")
//                   ・管理画面の「オーダーで使用済みにする」(via: "order")。lock を取った人だけが付ける
//      off キー   : 管理画面の無効化
//    レコード本体(rec)は発行時に作ったら書き換えない。状態はこの 3 キーから導く。
//  - Stripe には注文ごとの amount_off の Coupon(1 回限り)を作って渡すだけ。
// ---------------------------------------------------------------------------

const NS = "740nll:coupon";
const recKey = (code: string) => `${NS}:rec:${code}`;
const usedKey = (code: string) => `${NS}:used:${code}`;
const offKey = (code: string) => `${NS}:off:${code}`;
const lockKey = (code: string) => `${NS}:lock:${code}`;
const INDEX_KEY = `${NS}:index`;
const orderKey = (sessionId: string) => `${NS}:byorder:${sessionId}`;
const lineUidKey = (uid: string) => `${NS}:line:uid:${uid}`;
const lineDeviceKey = (dev: string) => `${NS}:line:dev:${dev}`;

// Checkout セッションの有効期間(これを過ぎると支払えない)と、予約の寿命。予約の方を少し長くする。
export const CHECKOUT_EXPIRES_SECONDS = 35 * 60;
export const RESERVE_SECONDS = 40 * 60;

const NOTE_MAX = 200;
// 紛らわしい 0/O/1/I/L を除いた英数大文字(31 種)。口頭・DM で伝えやすい。
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_PREFIX = "740-";

export type CouponSource = "admin" | "line" | "purchase";

type CouponRecord = {
  code: string;
  kind: CouponKind;
  percentOff: number;
  createdAt: number;
  source: CouponSource;
  note?: string;
  issuedBy?: string;
  // purchase: 特典の元になった注文(Checkout セッション ID)
  orderId?: string;
};

export function generateCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${CODE_PREFIX}${s}`;
}

// 入力欄の文字を正規形(740-XXXXXX)にする。形が違えば null。
export function parseCouponCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  let c = normalizeCouponCode(raw);
  if (/^740[A-Z2-9]{6}$/.test(c)) c = `740-${c.slice(3)}`;
  return COUPON_CODE_PATTERN.test(c) ? c : null;
}

function requireRedis() {
  const redis = getRedis();
  if (!redis) throw new Error("redis not configured");
  return redis;
}

function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as T;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function getRecord(code: string): Promise<CouponRecord | null> {
  const redis = requireRedis();
  const rec = parseJson<CouponRecord>(await redis.get(recKey(code)));
  if (rec && isCouponKind(rec.kind)) return rec;
  return rec ? null : await migrateLegacy(code);
}

// レコードを作る(すでにあれば何もしない)。index への登録も冪等。
async function putRecord(rec: CouponRecord): Promise<boolean> {
  const redis = requireRedis();
  const created = await redis.set(recKey(rec.code), JSON.stringify(rec), { nx: true });
  await redis.zadd(INDEX_KEY, { score: rec.createdAt, member: rec.code });
  return created !== null;
}

// used キーの中身。via が無い古い記録(sessionId だけ)は EC 扱い。
type UsedRecord = { via?: "ec" | "order"; sessionId?: string; at?: number; by?: string };
export type CouponUsedVia = "ec" | "order";

export type CouponStatus = "unused" | "reserved" | "used" | "disabled";

export type CouponView = {
  id: string;
  code: string;
  kind: CouponKind;
  kindLabel: string;
  source: CouponSource;
  note: string;
  percentOff: number;
  createdAt: number;
  status: CouponStatus;
  redeemedAt: number | null;
  usedVia: CouponUsedVia | null;
  usedBy: string | null;
};

function toView(
  rec: CouponRecord,
  used: UsedRecord | null,
  off: boolean,
  locked: boolean,
): CouponView {
  return {
    id: rec.code,
    code: rec.code,
    kind: rec.kind,
    kindLabel: COUPON_KINDS[rec.kind].label,
    source: rec.source,
    note: rec.note ?? "",
    percentOff: rec.percentOff,
    createdAt: rec.createdAt,
    status: used ? "used" : off ? "disabled" : locked ? "reserved" : "unused",
    redeemedAt: used?.at ?? null,
    usedVia: used ? (used.via === "order" ? "order" : "ec") : null,
    usedBy: used?.by ?? null,
  };
}

export async function getCouponView(code: string): Promise<CouponView | null> {
  const rec = await getRecord(code);
  if (!rec) return null;
  const redis = requireRedis();
  const [used, off, lock] = await Promise.all([
    redis.get(usedKey(code)),
    redis.get(offKey(code)),
    redis.get(lockKey(code)),
  ]);
  return toView(rec, parseJson<UsedRecord>(used), off != null, lock != null);
}

// ---------------------------------------------------------------------------
// 発行
// ---------------------------------------------------------------------------

async function newRecordWithUniqueCode(
  make: (code: string) => CouponRecord,
): Promise<CouponRecord> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const rec = make(generateCode());
    if (await putRecord(rec)) return rec;
  }
  throw new Error("could not generate a unique code");
}

// 管理画面からの発行(general30 = 全商品 30%)。
export async function issueAdminCoupon(input: {
  note?: string;
  issuedBy?: string;
}): Promise<CouponView> {
  const note = (input.note ?? "").trim().slice(0, NOTE_MAX);
  const rec = await newRecordWithUniqueCode((code) => ({
    code,
    kind: "general30",
    percentOff: GENERAL30_PERCENT,
    createdAt: Date.now(),
    source: "admin",
    ...(note ? { note } : {}),
    ...(input.issuedBy ? { issuedBy: input.issuedBy.slice(0, 100) } : {}),
  }));
  return toView(rec, null, false, false);
}

// 「このキーにはこのコードを 1 つだけ」を作る共通処理。
// 先にキー(code への対応)を SET NX で取り、その後でレコードを作る。途中で落ちても、
// 次の呼び出しが同じコードでレコードを作り直すので、コードだけ発行されて中身が無い状態は残らない。
async function claimCodeFor(
  keys: string[],
  make: (code: string) => CouponRecord,
): Promise<{ rec: CouponRecord; created: boolean }> {
  const redis = requireRedis();
  // すでに誰かが取っていればそのコード
  for (const k of keys) {
    const existing = await redis.get<string>(k);
    if (typeof existing === "string" && COUPON_CODE_PATTERN.test(existing)) {
      const rec = make(existing);
      // レコードが欠けていれば補う(rec は code から決まる内容なので何度作っても同じ)
      const had = parseJson<CouponRecord>(await redis.get(recKey(existing)));
      if (had) {
        await ensureKeys(keys, existing);
        return { rec: had, created: false };
      }
      await putRecord(rec);
      await ensureKeys(keys, existing);
      return { rec, created: false };
    }
  }
  // 新規。最初のキーを SET NX で取り合う
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const won = await redis.set(keys[0], code, { nx: true });
    if (won === null) {
      const winner = await redis.get<string>(keys[0]);
      if (typeof winner === "string" && COUPON_CODE_PATTERN.test(winner)) {
        const had = parseJson<CouponRecord>(await redis.get(recKey(winner)));
        const rec = had ?? make(winner);
        if (!had) await putRecord(rec);
        await ensureKeys(keys, winner);
        return { rec, created: false };
      }
      continue;
    }
    // コードが他のコードと偶然かぶったら(31^6)キーを取り直す
    const rec = make(code);
    if (!(await putRecord(rec))) {
      await redis.del(keys[0]);
      continue;
    }
    await ensureKeys(keys, code);
    return { rec, created: true };
  }
  throw new Error("could not generate a unique code");
}

async function ensureKeys(keys: string[], code: string) {
  const redis = requireRedis();
  for (const k of keys.slice(1)) await redis.set(k, code, { nx: true });
}

// LINE の受け取りページ用(necklace10)。uid(エルメの友だちごとの値)か端末 ID のどちらかで 1 人 1 枚。
// 両方あれば、どちらかで見つかった既存コードを返す。
export async function issueLineCoupon(input: {
  uid?: string | null;
  deviceId: string;
}): Promise<{ coupon: CouponView; created: boolean }> {
  const keys = [
    ...(input.uid ? [lineUidKey(input.uid)] : []),
    lineDeviceKey(input.deviceId),
  ];
  const { rec, created } = await claimCodeFor(keys, (code) => ({
    code,
    kind: "necklace10",
    percentOff: COUPON_KINDS.necklace10.percentOff,
    createdAt: Date.now(),
    source: "line",
  }));
  const view = await getCouponView(rec.code);
  return { coupon: view ?? toView(rec, null, false, false), created };
}

// すでに発行済みか(新規発行せずに調べる)。受け取りページで、レート制限を数える前に使う。
export async function findLineCoupon(input: {
  uid?: string | null;
  deviceId: string;
}): Promise<CouponView | null> {
  const redis = requireRedis();
  const keys = [
    ...(input.uid ? [lineUidKey(input.uid)] : []),
    lineDeviceKey(input.deviceId),
  ];
  for (const k of keys) {
    const code = await redis.get<string>(k);
    if (typeof code === "string" && COUPON_CODE_PATTERN.test(code)) {
      const v = await getCouponView(code);
      if (v) {
        await ensureKeys(keys.filter((x) => x !== k), code);
        return v;
      }
    }
  }
  return null;
}

// ネックレス購入特典(bracelet30)。注文(Checkout セッション ID)につき 1 枚。何度呼んでも同じコード。
export async function issueBraceletReward(sessionId: string): Promise<CouponView> {
  const { rec } = await claimCodeFor([orderKey(sessionId)], (code) => ({
    code,
    kind: "bracelet30",
    percentOff: COUPON_KINDS.bracelet30.percentOff,
    createdAt: Date.now(),
    source: "purchase",
    orderId: sessionId,
  }));
  return (await getCouponView(rec.code)) ?? toView(rec, null, false, false);
}

// 受け取りページ用の発行回数制限(固定窓)。上限を超えたら false。
export async function allowNewLineCoupon(ip: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  const LIMIT_PER_HOUR = 5;
  const bucket = Math.floor(Date.now() / 3_600_000);
  const key = `${NS}:rl:line:${ip}:${bucket}`;
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    return n <= LIMIT_PER_HOUR;
  } catch (e) {
    console.error("[coupons] line rate limit failed, fail-open:", e);
    return true;
  }
}

// ---------------------------------------------------------------------------
// 使う(予約 → 使用済み / 解放)
// ---------------------------------------------------------------------------

export type ReserveResult =
  | { ok: true; kind: CouponKind }
  | { ok: false; reason: "notfound" | "used" | "disabled" | "reserved" | "unavailable" };

// Checkout 作成時に「予約」する。token はこの Checkout 試行の印。取れるのは同時に 1 人だけ。
export async function reserveCoupon(code: string, token: string): Promise<ReserveResult> {
  const redis = getRedis();
  if (!redis) return { ok: false, reason: "unavailable" };
  const rec = await getRecord(code);
  if (!rec) return { ok: false, reason: "notfound" };
  const blocked = async (): Promise<"used" | "disabled" | null> => {
    const [used, off] = await Promise.all([redis.get(usedKey(code)), redis.get(offKey(code))]);
    return used != null ? "used" : off != null ? "disabled" : null;
  };
  const pre = await blocked();
  if (pre) return { ok: false, reason: pre };
  const got = await redis.set(lockKey(code), token, { nx: true, ex: RESERVE_SECONDS });
  if (got === null) return { ok: false, reason: "reserved" };
  // 取った直後にもう一度確認する(確認と SET の間に使用済み・無効化された場合に戻す)
  const post = await blocked();
  if (post) {
    await redis.del(lockKey(code));
    return { ok: false, reason: post };
  }
  return { ok: true, kind: rec.kind };
}

// 予約を解く(未使用に戻す)。token が一致する時だけ。期限切れ・失敗・キャンセルで呼ぶ。
export async function releaseCoupon(code: string, token: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const cur = await redis.get<string>(lockKey(code));
  if (cur !== token) return false;
  await redis.del(lockKey(code));
  return true;
}

// 管理画面から「オーダー(Instagram DM)で使用済みにする」。
// EC の予約(reserveCoupon)と同じ lock キーを SET NX で取り合うので、決済の手続き中とは両立しない。
//  - 先に EC が lock を取った → こちらは "reserved" で断る
//  - 先にこちらが lock を取った → EC の reserveCoupon は "reserved"、取った後の再確認でも used を見て弾く
// lock は短い寿命(60 秒)で、used を付けたら外す。途中で落ちても自然に未使用へ戻る。
export type OrderUseResult = "ok" | "not_found" | "used" | "disabled" | "reserved";

export async function markCouponUsedByOrder(code: string, by: string): Promise<OrderUseResult> {
  const redis = requireRedis();
  const rec = await getRecord(code);
  if (!rec) return "not_found";
  const blocked = async (): Promise<"used" | "disabled" | null> => {
    const [used, off] = await Promise.all([redis.get(usedKey(code)), redis.get(offKey(code))]);
    return used != null ? "used" : off != null ? "disabled" : null;
  };
  const pre = await blocked();
  if (pre) return pre;
  const token = `order:${randomInt(1_000_000_000)}`;
  const got = await redis.set(lockKey(code), token, { nx: true, ex: 60 });
  if (got === null) return "reserved";
  try {
    const post = await blocked();
    if (post) return post;
    const set = await redis.set(
      usedKey(code),
      JSON.stringify({ via: "order", at: Date.now(), by: by.slice(0, 100) } satisfies UsedRecord),
      { nx: true },
    );
    return set === null ? "used" : "ok";
  } finally {
    // 自分の lock のときだけ外す
    if ((await redis.get<string>(lockKey(code))) === token) await redis.del(lockKey(code));
  }
}

// 支払い確定(Webhook)。予約が切れていても、お金が動いた以上は使用済みにする。何度呼んでも同じ。
export async function markCouponUsed(code: string, sessionId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(usedKey(code), JSON.stringify({ via: "ec", sessionId, at: Date.now() } satisfies UsedRecord), {
    nx: true,
  });
  await redis.del(lockKey(code));
}

// ---------------------------------------------------------------------------
// 管理画面
// ---------------------------------------------------------------------------

export async function listCoupons(limit = 200): Promise<CouponView[]> {
  const redis = requireRedis();
  await migrateAllLegacy().catch((e) =>
    console.error("[coupons] legacy migration skipped:", e),
  );
  const codes = (await redis.zrange(INDEX_KEY, 0, limit - 1, { rev: true })) as string[];
  if (codes.length === 0) return [];
  const [recs, useds, offs, locks] = await Promise.all([
    redis.mget(...codes.map(recKey)),
    redis.mget(...codes.map(usedKey)),
    redis.mget(...codes.map(offKey)),
    redis.mget(...codes.map(lockKey)),
  ]);
  const out: CouponView[] = [];
  codes.forEach((_, i) => {
    const rec = parseJson<CouponRecord>(recs[i]);
    if (!rec || !isCouponKind(rec.kind)) return;
    out.push(toView(rec, parseJson<UsedRecord>(useds[i]), offs[i] != null, locks[i] != null));
  });
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

// 未使用のコードだけ無効にできる。
export async function disableCoupon(
  code: string,
): Promise<"ok" | "not_found" | "already_used" | "reserved"> {
  const redis = requireRedis();
  const rec = await getRecord(code);
  if (!rec) return "not_found";
  if ((await redis.get(usedKey(code))) != null) return "already_used";
  if ((await redis.get(lockKey(code))) != null) return "reserved";
  await redis.set(offKey(code), "1");
  // 立てた直後に決済が走っていた場合は使用済みの方を優先して案内する
  if ((await redis.get(usedKey(code))) != null) return "already_used";
  return "ok";
}

// ---------------------------------------------------------------------------
// 旧方式(Stripe の Promotion Code)で発行済みの管理画面コードの引き継ぎ。
// 未使用の 30%オフだけを Redis に取り込み、Stripe 側は無効にする(二重に使えないように)。
// ---------------------------------------------------------------------------

const LEGACY_SOURCE_VALUE = "740nll-admin";

async function importLegacy(p: Stripe.PromotionCode): Promise<string | null> {
  if (p.metadata?.source !== LEGACY_SOURCE_VALUE) return null;
  if (!p.active || p.times_redeemed > 0) return null;
  const coupon = p.promotion?.coupon;
  const percent = coupon && typeof coupon === "object" ? coupon.percent_off : null;
  if (percent !== GENERAL30_PERCENT) return null;
  if (!COUPON_CODE_PATTERN.test(p.code)) return null;
  await putRecord({
    code: p.code,
    kind: "general30",
    percentOff: GENERAL30_PERCENT,
    createdAt: p.created * 1000,
    source: "admin",
    ...(p.metadata?.note ? { note: p.metadata.note.slice(0, NOTE_MAX) } : {}),
    ...(p.metadata?.issued_by ? { issuedBy: p.metadata.issued_by } : {}),
  });
  await getStripe().promotionCodes.update(p.id, { active: false });
  return p.code;
}

async function migrateLegacy(code: string): Promise<CouponRecord | null> {
  if (!process.env.STRIPE_SECRET_KEY || !COUPON_CODE_PATTERN.test(code)) return null;
  try {
    const res = await getStripe().promotionCodes.list({
      code,
      active: true,
      limit: 1,
      expand: ["data.promotion.coupon"],
    });
    const p = res.data[0];
    if (!p || !(await importLegacy(p))) return null;
    return parseJson<CouponRecord>(await requireRedis().get(recKey(code)));
  } catch (e) {
    console.error("[coupons] legacy lookup failed:", e);
    return null;
  }
}

async function migrateAllLegacy(): Promise<void> {
  if (!process.env.STRIPE_SECRET_KEY) return;
  const res = await getStripe().promotionCodes.list({
    active: true,
    limit: 100,
    expand: ["data.promotion.coupon"],
  });
  for (const p of res.data) await importLegacy(p);
}

// ---------------------------------------------------------------------------
// 注文への記録(Webhook から)
// ---------------------------------------------------------------------------

export type OrderDiscount = {
  code: string | null;
  kind: CouponKind | null;
  amount: number;
};

// 決済済みセッションで使われたクーポン。自前のコードはセッションの metadata に入れてある。
export async function resolveSessionDiscount(
  session: Stripe.Checkout.Session,
): Promise<OrderDiscount | null> {
  const amount = session.total_details?.amount_discount ?? 0;
  if (amount <= 0) return null;
  const code = session.metadata?.coupon_code ?? null;
  const kindRaw = session.metadata?.coupon_kind;
  return { code, kind: isCouponKind(kindRaw) ? kindRaw : null, amount };
}
