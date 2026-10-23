import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

// KV_REST_API_URL / UPSTASH_REDIS_REST_URL のどちらでも動く(他の lib と同じ規則)。
export function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}
