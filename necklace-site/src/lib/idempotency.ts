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

const TTL_SECONDS = 60 * 60 * 24 * 7;

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    console.warn(
      "[idempotency] KV not configured — webhook events may be processed multiple times",
    );
    return false;
  }
  try {
    const result = await redis.set(
      `740nll:webhook:event:${eventId}`,
      "1",
      { nx: true, ex: TTL_SECONDS },
    );
    return result === null;
  } catch (e) {
    console.error("[idempotency] failed, fail-open:", e);
    return false;
  }
}
