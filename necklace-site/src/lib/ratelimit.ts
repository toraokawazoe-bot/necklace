import { Ratelimit } from "@upstash/ratelimit";
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

const _limiters = new Map<string, Ratelimit>();

function makeLimiter(prefix: string, tokens: number, window: string): Ratelimit | null {
  if (_limiters.has(prefix)) return _limiters.get(prefix)!;
  const redis = getRedis();
  if (!redis) return null;
  const lim = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window as `${number} ${"s" | "m" | "h"}`),
    prefix: `740nll:rl:${prefix}`,
    analytics: false,
  });
  _limiters.set(prefix, lim);
  return lim;
}

export const checkoutLimiter = () =>
  makeLimiter("checkout", 10, "10 m");
export const adminAuthLimiter = () =>
  makeLimiter("admin-auth", 20, "10 m");
export const uploadLimiter = () =>
  makeLimiter("upload", 30, "10 m");

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function enforce(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ ok: true } | { ok: false; reset: number }> {
  if (!limiter) return { ok: true };
  const result = await limiter.limit(identifier);
  if (result.success) return { ok: true };
  return { ok: false, reset: result.reset };
}
