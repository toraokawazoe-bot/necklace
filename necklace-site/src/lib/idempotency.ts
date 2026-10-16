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
// 処理中ロックの寿命。プロセスが途中で落ちても、この時間が過ぎれば Stripe の再送を受け付ける。
const LOCK_SECONDS = 120;
const eventKey = (eventId: string) => `740nll:webhook:event:${eventId}`;

export type EventClaim = "claimed" | "done" | "in_progress";

// Webhook イベントの処理権を取る。
// claimed=このリクエストが処理する / done=処理済み(スキップ) / in_progress=別リクエストが処理中(500で再送させる)
// 「処理済み」は completeEvent で成功後にだけ確定する。失敗したら releaseEvent でロックを外す。
export async function claimEvent(eventId: string): Promise<EventClaim> {
  const redis = getRedis();
  if (!redis) {
    console.warn(
      "[idempotency] KV not configured — webhook events may be processed multiple times",
    );
    return "claimed";
  }
  try {
    const result = await redis.set(eventKey(eventId), "processing", {
      nx: true,
      ex: LOCK_SECONDS,
    });
    if (result !== null) return "claimed";
    const current = await redis.get<string>(eventKey(eventId));
    return current === "done" ? "done" : "in_progress";
  } catch (e) {
    // Redis 障害時は止めない。注文側も session.id 単位で冪等なので二重処理は防げる。
    console.error("[idempotency] claim failed, fail-open:", e);
    return "claimed";
  }
}

export async function completeEvent(eventId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(eventKey(eventId), "done", { ex: TTL_SECONDS });
  } catch (e) {
    console.error("[idempotency] complete failed:", e);
  }
}

export async function releaseEvent(eventId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(eventKey(eventId));
  } catch (e) {
    console.error("[idempotency] release failed:", e);
  }
}

// 「この処理は1回だけ」の印。true=初回(実行してよい) / false=実行済み。
// メール送信の二重送信防止用。Redis 障害時は止めずに実行側へ倒す(メール欠落より重複の方がまし)。
export async function claimOnce(key: string, ttlSeconds = TTL_SECONDS * 4): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const result = await redis.set(`740nll:once:${key}`, "1", {
      nx: true,
      ex: ttlSeconds,
    });
    return result !== null;
  } catch (e) {
    console.error("[idempotency] claimOnce failed, fail-open:", e);
    return true;
  }
}
