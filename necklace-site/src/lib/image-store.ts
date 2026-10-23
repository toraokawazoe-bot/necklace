import { Redis } from "@upstash/redis";
import { stripImageMetadata } from "@/lib/image-sanitize";

// 商品画像の保存先。Vercel Blob はチーム共有の無料枠を他案件に使い切られて止まったので
// （2026-10-14）、商品データと同じ Upstash Redis に置き、/api/images/<id> で配信する。
// 画像は送信前に 2MB 以下へ縮めてあるので、1 件 1 キーで十分収まる。

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

const NS = "740nll:images";
const key = (id: string) => `${NS}:${id}`;

export const IMAGE_ID = /^[a-z0-9-]{8,40}\.(jpeg|png|webp|avif)$/;

type StoredImage = { type: string; data: string };

export async function saveImage(file: File): Promise<string> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis not configured");
  const ext = file.type.split("/")[1];
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  // 位置情報などのメタデータを外してから保存する(失敗したら保存しない)
  const clean = await stripImageMetadata(
    Buffer.from(await file.arrayBuffer()),
    file.type,
  );
  const data = clean.toString("base64");
  const value: StoredImage = { type: file.type, data };
  await redis.set(key(id), JSON.stringify(value));
  return `/api/images/${id}`;
}

export async function loadImage(
  id: string,
): Promise<{ type: string; body: Buffer } | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get(key(id));
  if (!raw) return null;
  const v = (typeof raw === "string" ? JSON.parse(raw) : raw) as StoredImage;
  return { type: v.type, body: Buffer.from(v.data, "base64") };
}
