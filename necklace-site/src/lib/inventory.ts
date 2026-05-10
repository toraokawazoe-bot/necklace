import { Redis } from "@upstash/redis";

const SOLD_OUT_KEY = "740nll:sold_out";

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

export async function getSoldOutIds(): Promise<Set<string>> {
  const redis = getRedis();
  if (!redis) return new Set();
  try {
    const ids = (await redis.smembers(SOLD_OUT_KEY)) as string[];
    return new Set(ids);
  } catch (e) {
    console.error("[inventory] getSoldOutIds failed:", e);
    return new Set();
  }
}

export async function markSoldOut(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const redis = getRedis();
  if (!redis) {
    console.warn("[inventory] markSoldOut: KV not configured, skipping");
    return;
  }
  try {
    await redis.sadd(SOLD_OUT_KEY, productIds[0], ...productIds.slice(1));
  } catch (e) {
    console.error("[inventory] markSoldOut failed:", e);
  }
}

export async function unmarkSoldOut(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return;
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.srem(SOLD_OUT_KEY, productIds[0], ...productIds.slice(1));
  } catch (e) {
    console.error("[inventory] unmarkSoldOut failed:", e);
  }
}
