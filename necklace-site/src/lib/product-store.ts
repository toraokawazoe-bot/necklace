import { Redis } from "@upstash/redis";
import type { Product } from "./products";
import { resolveLegacyImage } from "./legacy-images";
import { resolveCategory } from "./product-category";
import { deleteStock, getStockMap, setStock } from "./inventory";

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

const NS = "740nll:products";
const LIST_KEY = `${NS}:list`;
const itemKey = (id: string) => `${NS}:item:${id}`;
const slugKey = (slug: string) => `${NS}:slug:${slug}`;

export type ProductInput = Omit<
  Product,
  "createdAt" | "updatedAt" | "sortOrder"
> & {
  sortOrder?: number;
};

function parseProduct(raw: unknown): Product | null {
  if (!raw) return null;
  let obj: Product | null = null;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Product;
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    obj = raw as Product;
  }
  if (!obj) return null;
  if (!Array.isArray(obj.gallery)) obj.gallery = [];
  // カテゴリ未設定の既存商品は necklace 扱い
  obj.category = resolveCategory(obj.category);
  if (typeof obj.image === "string") obj.image = resolveLegacyImage(obj.image);
  obj.gallery = obj.gallery.map((u) => (typeof u === "string" ? resolveLegacyImage(u) : u));
  return obj;
}

// 在庫カウンタ(Redis)の残数を重ねる。カウンタが無い商品は stock=null(無制限)。
async function withStock(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;
  let map: Map<string, number>;
  try {
    map = await getStockMap(products.map((p) => p.id));
  } catch (e) {
    console.error("[product-store] getStockMap failed:", e);
    map = new Map();
  }
  return products.map((p) => ({ ...p, stock: map.get(p.id) ?? null }));
}

// 保存する商品JSONには残数を持たない(残数の実体は在庫カウンタ)
function toStored(p: Product): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stock, ...rest } = p;
  return JSON.stringify(rest);
}

export async function listProducts(opts?: {
  includeUnpublished?: boolean;
}): Promise<Product[]> {
  const redis = getRedis();
  if (!redis) return [];
  const ids = (await redis.zrange(LIST_KEY, 0, -1)) as string[];
  if (ids.length === 0) return [];
  const raws = (await Promise.all(ids.map((id) => redis.get(itemKey(id))))) as unknown[];
  const parsed = raws
    .map(parseProduct)
    .filter((p): p is Product => p !== null);
  const products = await withStock(parsed);
  if (opts?.includeUnpublished) return products;
  return products.filter((p) => p.published !== false);
}

export async function getProduct(id: string): Promise<Product | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get(itemKey(id));
  const product = parseProduct(raw);
  if (!product) return null;
  return (await withStock([product]))[0];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const redis = getRedis();
  if (!redis) return null;
  const id = (await redis.get(slugKey(slug))) as string | null;
  if (!id) return null;
  return getProduct(id);
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function generateId(): string {
  return `p_${nowSec().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not configured");

  const existingForSlug = await redis.get(slugKey(input.slug));
  if (existingForSlug) {
    throw new Error(`スラッグが既に使われています: ${input.slug}`);
  }

  const id = input.id || generateId();
  const ids = (await redis.zrange(LIST_KEY, 0, -1)) as string[];
  const sortOrder = input.sortOrder ?? ids.length;
  const product: Product = {
    ...input,
    id,
    sortOrder,
    createdAt: nowSec(),
    updatedAt: nowSec(),
  };
  await Promise.all([
    redis.set(itemKey(id), toStored(product)),
    redis.set(slugKey(product.slug), id),
    redis.zadd(LIST_KEY, { score: sortOrder, member: id }),
  ]);
  if (typeof input.stock === "number") await setStock(id, input.stock);
  return { ...product, stock: typeof input.stock === "number" ? input.stock : null };
}

export async function updateProduct(
  id: string,
  patch: Partial<Omit<Product, "id" | "createdAt">>,
): Promise<Product> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not configured");
  const current = await getProduct(id);
  if (!current) throw new Error("Product not found");

  if (patch.slug && patch.slug !== current.slug) {
    const existing = await redis.get(slugKey(patch.slug));
    if (existing && existing !== id) {
      throw new Error(`スラッグが既に使われています: ${patch.slug}`);
    }
  }

  const updated: Product = {
    ...current,
    ...patch,
    category: resolveCategory(patch.category ?? current.category),
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nowSec(),
  };

  const ops: Promise<unknown>[] = [
    redis.set(itemKey(id), toStored(updated)),
  ];
  // 在庫数: patch に stock があり、現在の残数と違う時だけカウンタを書く(他の項目の保存で残数を巻き戻さない)
  if (patch.stock !== undefined && (patch.stock ?? null) !== (current.stock ?? null)) {
    ops.push(setStock(id, patch.stock ?? null));
  }
  if (patch.slug && patch.slug !== current.slug) {
    ops.push(redis.del(slugKey(current.slug)));
    ops.push(redis.set(slugKey(updated.slug), id));
  }
  if (patch.sortOrder !== undefined && patch.sortOrder !== current.sortOrder) {
    ops.push(redis.zadd(LIST_KEY, { score: patch.sortOrder, member: id }));
  }
  await Promise.all(ops);
  return updated;
}

export async function deleteProduct(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not configured");
  const product = await getProduct(id);
  if (!product) return;
  await Promise.all([
    redis.del(itemKey(id)),
    redis.del(slugKey(product.slug)),
    redis.zrem(LIST_KEY, id),
    deleteStock(id),
  ]);
}

export async function reorderProducts(orderedIds: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not configured");
  if (orderedIds.length === 0) return;
  const ops: Promise<unknown>[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    ops.push(redis.zadd(LIST_KEY, { score: i, member: id }));
    const product = await getProduct(id);
    if (product) {
      product.sortOrder = i;
      product.updatedAt = nowSec();
      ops.push(redis.set(itemKey(id), toStored(product)));
    }
  }
  await Promise.all(ops);
}

export async function getAllSlugs(): Promise<string[]> {
  const products = await listProducts();
  return products.map((p) => p.slug);
}
