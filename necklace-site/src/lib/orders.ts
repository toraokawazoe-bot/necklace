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

export type OrderStatus = "paid" | "failed" | "expired";

export type StoredOrderItem = {
  name: string;
  qty: number;
  amountTotal: number;
};

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
};

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
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as StoredOrder;
  } catch {
    return null;
  }
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
