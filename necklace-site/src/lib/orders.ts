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
    case "japanpost_letter":
      return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${tn}&locale=ja`;
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

export async function recordOrder(order: StoredOrder): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    console.warn("[orders] redis not configured — skipping record");
    return;
  }
  try {
    const json = JSON.stringify(order);
    await redis.lpush(RECENT_KEY, json);
    await redis.ltrim(RECENT_KEY, 0, RECENT_LIMIT - 1);

    if (order.status === "paid") {
      await Promise.all([
        redis.incr(`${NS}:count:paid:total`),
        redis.incrby(`${NS}:revenue:total`, order.amountTotal),
        redis.incr(
          `${NS}:count:paid:day:${new Date(order.createdAt).toISOString().slice(0, 10)}`,
        ),
        redis.incrby(
          `${NS}:revenue:day:${new Date(order.createdAt).toISOString().slice(0, 10)}`,
          order.amountTotal,
        ),
      ]);
    } else {
      await redis.incr(`${NS}:count:${order.status}:total`);
    }
  } catch (e) {
    console.error("[orders] recordOrder failed:", e);
  }
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
