import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

const NS = "740nll:orders";
const RECENT_KEY = `${NS}:recent`;
const RECENT_LIMIT = 200;

export type OrderStatus = "paid" | "failed" | "expired" | "refunded";

export type StoredOrderItem = {
  name: string;
  qty: number;
  amountTotal: number;
};

export type Carrier =
  | "japanpost_clickpost"
  | "japanpost_yupacket"
  | "japanpost_yupack"
  | "japanpost_letter"
  | "yamato"
  | "sagawa"
  | "other";

export type StoredOrder = {
  sessionId: string;
  status: OrderStatus;
  createdAt: number;
  amountTotal: number;
  currency: string;
  email: string | null;
  customerName: string | null;
  items: StoredOrderItem[];
  paymentMethod: string | null;
  shippingSummary: string | null;
  // クーポン利用時のみ。割引額は円(正の数)、couponCode は使われたコード(取れなければ無し)。
  couponCode?: string;
  discountAmount?: number;
  shippedAt?: number;
  carrier?: Carrier;
  trackingNumber?: string;
};

export function trackingUrl(
  carrier: Carrier | undefined,
  trackingNumber: string | undefined,
): string | null {
  if (!trackingNumber) return null;
  const tn = encodeURIComponent(trackingNumber);
  switch (carrier) {
    case "japanpost_clickpost":
    case "japanpost_yupacket":
    case "japanpost_yupack":
      return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${tn}&locale=ja`;
    // japanpost_letter（定形外郵便）は追跡番号がないので default→null（ラベルの「追跡なし」と整合）。
    case "yamato":
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number01=${tn}`;
    case "sagawa":
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijostate?okurijoNo=${tn}`;
    default:
      return null;
  }
}

export function carrierLabel(carrier: Carrier | undefined): string {
  switch (carrier) {
    case "japanpost_clickpost":
      return "クリックポスト";
    case "japanpost_yupacket":
      return "ゆうパケット";
    case "japanpost_yupack":
      return "ゆうパック";
    case "japanpost_letter":
      return "定形外郵便";
    case "yamato":
      return "ヤマト運輸";
    case "sagawa":
      return "佐川急便";
    case "other":
      return "その他";
    default:
      return "—";
  }
}

// 注文を session.id × status 単位で冪等に記録する。
// 戻り値: true=新規に記録した / false=既に記録済み(再送・重複イベント)。
// Redis の失敗は握りつぶさず呼び出し元へ投げる(Webhook が 500 を返して Stripe に再送させるため)。
// 「記録済みの印」と一覧・集計の更新は1つの Lua スクリプトで行い、片方だけ成功する状態を作らない。
export async function recordOrder(order: StoredOrder): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[orders] redis not configured — skipping record");
    return true;
  }
  const day = new Date(order.createdAt).toISOString().slice(0, 10);
  const isPaid = order.status === "paid";
  const script = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[1], '1')
redis.call('LPUSH', KEYS[2], ARGV[1])
redis.call('LTRIM', KEYS[2], 0, tonumber(ARGV[2]) - 1)
redis.call('INCR', KEYS[3])
if ARGV[3] == '1' then
  redis.call('INCRBY', KEYS[4], tonumber(ARGV[4]))
  redis.call('INCR', KEYS[5])
  redis.call('INCRBY', KEYS[6], tonumber(ARGV[4]))
end
return 1`;
  const created = await redis.eval(
    script,
    [
      `${NS}:recorded:${order.sessionId}:${order.status}`,
      RECENT_KEY,
      isPaid ? `${NS}:count:paid:total` : `${NS}:count:${order.status}:total`,
      `${NS}:revenue:total`,
      `${NS}:count:paid:day:${day}`,
      `${NS}:revenue:day:${day}`,
    ],
    [
      JSON.stringify(order),
      String(RECENT_LIMIT),
      isPaid ? "1" : "0",
      String(order.amountTotal),
    ],
  );
  return Number(created) === 1;
}

// 全額返金(charge.refunded)で該当注文を refunded にする。見つかって更新したら true。
export async function markOrderRefunded(sessionId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const raw = await redis.lrange(RECENT_KEY, 0, -1);
  for (let i = 0; i < raw.length; i++) {
    const order = parseOrder(raw[i]);
    if (!order || order.sessionId !== sessionId) continue;
    if (order.status === "refunded") return false;
    if (order.status !== "paid") continue;
    await redis.lset(RECENT_KEY, i, JSON.stringify({ ...order, status: "refunded" }));
    await redis.incr(`${NS}:count:refunded:total`);
    return true;
  }
  return false;
}

export type OrderStats = {
  configured: boolean;
  paidCount: number;
  failedCount: number;
  expiredCount: number;
  revenueTotal: number;
  recent: StoredOrder[];
};

function parseOrder(raw: unknown): StoredOrder | null {
  if (raw && typeof raw === "object") {
    return raw as StoredOrder;
  }
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as StoredOrder;
  } catch {
    return null;
  }
}

export async function markOrderShipped(input: {
  sessionId: string;
  carrier?: Carrier;
  trackingNumber?: string;
}): Promise<StoredOrder | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.lrange(RECENT_KEY, 0, -1);
  for (let i = 0; i < raw.length; i++) {
    const order = parseOrder(raw[i]);
    if (!order || order.sessionId !== input.sessionId) continue;
    const updated: StoredOrder = {
      ...order,
      shippedAt: Date.now(),
      carrier: input.carrier ?? order.carrier,
      trackingNumber: input.trackingNumber ?? order.trackingNumber,
    };
    await redis.lset(RECENT_KEY, i, JSON.stringify(updated));
    return updated;
  }
  return null;
}

export async function readOrderStats(limit = 30): Promise<OrderStats> {
  const redis = getRedis();
  const empty: OrderStats = {
    configured: false,
    paidCount: 0,
    failedCount: 0,
    expiredCount: 0,
    revenueTotal: 0,
    recent: [],
  };
  if (!redis) return empty;

  try {
    const [paid, failed, expired, revenue, recentRaw] = await Promise.all([
      redis.get<number>(`${NS}:count:paid:total`),
      redis.get<number>(`${NS}:count:failed:total`),
      redis.get<number>(`${NS}:count:expired:total`),
      redis.get<number>(`${NS}:revenue:total`),
      redis.lrange(RECENT_KEY, 0, limit - 1),
    ]);

    const recent: StoredOrder[] = [];
    for (const r of recentRaw ?? []) {
      const parsed = parseOrder(r);
      if (parsed) recent.push(parsed);
    }

    return {
      configured: true,
      paidCount: Number(paid ?? 0),
      failedCount: Number(failed ?? 0),
      expiredCount: Number(expired ?? 0),
      revenueTotal: Number(revenue ?? 0),
      recent,
    };
  } catch (e) {
    console.error("[orders] readOrderStats failed:", e);
    return empty;
  }
}
