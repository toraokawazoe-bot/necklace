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

// ---- 在庫数(任意) ----
// 商品に在庫数を設定した時だけ Redis に残数カウンタを持つ。カウンタが無い商品は無制限。
// 商品JSONに残数を持たないのは、購入時に原子的(DECRBY)に減らすため。
const STOCK_NS = "740nll:stock";
const stockKey = (productId: string) => `${STOCK_NS}:${productId}`;
// 注文(Stripe session)ごとに「在庫を減らした」印。Webhook再送での二重減算を防ぐ。
const stockAppliedKey = (sessionId: string) => `${STOCK_NS}:applied:${sessionId}`;

// 商品ID -> 残数。無制限の商品は含めない。
export async function getStockMap(
  productIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const redis = getRedis();
  if (!redis || productIds.length === 0) return map;
  const values = await redis.mget<(number | string | null)[]>(
    ...productIds.map(stockKey),
  );
  productIds.forEach((id, i) => {
    const v = values[i];
    if (v === null || v === undefined) return;
    const n = Number(v);
    if (Number.isFinite(n)) map.set(id, n);
  });
  return map;
}

// 管理画面から。null=無制限(カウンタ削除)、数値=その数にセット。
export async function setStock(
  productId: string,
  stock: number | null,
): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not configured");
  if (stock === null) {
    await redis.del(stockKey(productId));
  } else {
    await redis.set(stockKey(productId), Math.floor(stock));
  }
}

export async function deleteStock(productId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(stockKey(productId));
}

export type StockDecrementResult = {
  // false = この注文では既に減算済み(Webhook再送など)
  applied: boolean;
  // 減算後の残数が 0 未満になった商品(売り越し)
  oversold: { productId: string; remaining: number }[];
  // 減算後の残数が 0 になった商品
  soldOut: string[];
};

// 支払い確定時に在庫を原子的に減らす。同じ sessionId では1回だけ。
// 在庫数を設定していない商品(カウンタ無し)は何もしない。
export async function decrementStockForOrder(
  sessionId: string,
  lines: { productId: string; qty: number }[],
): Promise<StockDecrementResult> {
  const result: StockDecrementResult = { applied: false, oversold: [], soldOut: [] };
  const redis = getRedis();
  if (!redis) {
    console.warn("[inventory] decrementStockForOrder: KV not configured, skipping");
    return result;
  }
  // 同じ商品が長さ違いで複数行ある場合は合算
  const totals = new Map<string, number>();
  for (const l of lines) {
    totals.set(l.productId, (totals.get(l.productId) ?? 0) + l.qty);
  }
  const ids = [...totals.keys()];
  // KEYS[1]=適用済みマーカー, KEYS[2..]=在庫カウンタ。マーカー設定と減算を1つのスクリプトで行う。
  // 戻り値: 先頭が 0 ならマーカーが既にあり何もしていない。1 なら続けて各商品の減算後の値(カウンタ無しは -2147483648 = 無制限)。
  const script = `
if redis.call('EXISTS', KEYS[1]) == 1 then return {0} end
redis.call('SET', KEYS[1], '1')
local out = {1}
for i = 2, #KEYS do
  if redis.call('EXISTS', KEYS[i]) == 1 then
    out[#out + 1] = redis.call('DECRBY', KEYS[i], tonumber(ARGV[i - 1]))
  else
    out[#out + 1] = -2147483648
  end
end
return out`;
  const out = (await redis.eval(
    script,
    [stockAppliedKey(sessionId), ...ids.map(stockKey)],
    ids.map((id) => String(totals.get(id))),
  )) as number[];
  if (!Array.isArray(out) || Number(out[0]) !== 1) {
    return result;
  }
  result.applied = true;
  ids.forEach((id, i) => {
    const remaining = Number(out[i + 1]);
    if (remaining === -2147483648) return; // 無制限
    if (remaining < 0) result.oversold.push({ productId: id, remaining });
    if (remaining <= 0) result.soldOut.push(id);
  });
  return result;
}
