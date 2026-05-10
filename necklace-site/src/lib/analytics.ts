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

const NS = "740nll:analytics";

function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function pastDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function normalizeReferrer(raw: string | null | undefined): string {
  if (!raw) return "(direct)";
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host) return "(direct)";
    return host;
  } catch {
    return "(direct)";
  }
}

function normalizePath(raw: string | null | undefined): string {
  if (!raw) return "/";
  try {
    const u = new URL(raw, "http://x");
    let p = u.pathname || "/";
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  } catch {
    return "/";
  }
}

export type TrackInput = {
  path: string;
  referrer: string | null;
  visitorId: string;
  ownHost?: string;
};

export async function track(input: TrackInput): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const day = dayKey();
  const path = normalizePath(input.path);
  let ref = normalizeReferrer(input.referrer);
  if (input.ownHost && ref === input.ownHost.replace(/^www\./, "").toLowerCase()) {
    ref = "(internal)";
  }
  try {
    await Promise.all([
      redis.incr(`${NS}:pv:total`),
      redis.incr(`${NS}:pv:day:${day}`),
      redis.hincrby(`${NS}:pv:path`, path, 1),
      redis.hincrby(`${NS}:pv:path:day:${day}`, path, 1),
      redis.hincrby(`${NS}:ref`, ref, 1),
      redis.hincrby(`${NS}:ref:day:${day}`, ref, 1),
      redis.pfadd(`${NS}:uv:total`, input.visitorId),
      redis.pfadd(`${NS}:uv:day:${day}`, input.visitorId),
    ]);
  } catch (e) {
    console.error("[analytics] track failed:", e);
  }
}

export type AnalyticsSnapshot = {
  configured: boolean;
  totals: { pv: number; uv: number };
  today: { pv: number; uv: number; date: string };
  daily: { date: string; pv: number; uv: number }[];
  topPaths: { path: string; count: number }[];
  topReferrers: { source: string; count: number }[];
  todayReferrers: { source: string; count: number }[];
};

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function hashToSorted(
  h: Record<string, unknown> | null,
  key: "path" | "source",
  limit: number,
): { count: number; path?: string; source?: string }[] {
  if (!h) return [];
  const entries = Object.entries(h).map(([k, v]) => ({
    [key]: k,
    count: toNumber(v),
  }));
  entries.sort((a, b) => (b.count as number) - (a.count as number));
  return entries.slice(0, limit) as never;
}

export async function readSnapshot(days = 14): Promise<AnalyticsSnapshot> {
  const redis = getRedis();
  const today = dayKey();
  const empty: AnalyticsSnapshot = {
    configured: false,
    totals: { pv: 0, uv: 0 },
    today: { pv: 0, uv: 0, date: today },
    daily: [],
    topPaths: [],
    topReferrers: [],
    todayReferrers: [],
  };
  if (!redis) return empty;

  const dayList = pastDays(days);
  const dayKeys = dayList.map((d) => `${NS}:pv:day:${d}`);
  const uvKeys = dayList.map((d) => `${NS}:uv:day:${d}`);

  try {
    const [
      pvTotal,
      uvTotal,
      pvToday,
      pathHash,
      refHash,
      refTodayHash,
      pvDayValues,
    ] = await Promise.all([
      redis.get<number>(`${NS}:pv:total`),
      redis.pfcount(`${NS}:uv:total`),
      redis.get<number>(`${NS}:pv:day:${today}`),
      redis.hgetall<Record<string, unknown>>(`${NS}:pv:path`),
      redis.hgetall<Record<string, unknown>>(`${NS}:ref`),
      redis.hgetall<Record<string, unknown>>(`${NS}:ref:day:${today}`),
      redis.mget<number[]>(...dayKeys),
    ]);

    const uvDayValues = await Promise.all(
      uvKeys.map((k) => redis.pfcount(k).catch(() => 0)),
    );

    const daily = dayList
      .map((d, i) => ({
        date: d,
        pv: toNumber(pvDayValues?.[i]),
        uv: toNumber(uvDayValues[i]),
      }))
      .reverse();

    const todayUv = await redis.pfcount(`${NS}:uv:day:${today}`).catch(() => 0);

    return {
      configured: true,
      totals: { pv: toNumber(pvTotal), uv: toNumber(uvTotal) },
      today: { pv: toNumber(pvToday), uv: toNumber(todayUv), date: today },
      daily,
      topPaths: hashToSorted(pathHash, "path", 12).map((x) => ({
        path: x.path as string,
        count: x.count,
      })),
      topReferrers: hashToSorted(refHash, "source", 12).map((x) => ({
        source: x.source as string,
        count: x.count,
      })),
      todayReferrers: hashToSorted(refTodayHash, "source", 12).map((x) => ({
        source: x.source as string,
        count: x.count,
      })),
    };
  } catch (e) {
    console.error("[analytics] readSnapshot failed:", e);
    return empty;
  }
}
