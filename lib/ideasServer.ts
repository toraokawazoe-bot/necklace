// サーバー専用: iPhone の共有ボタン(iOSショートカット)からアイデアを受け取る処理。
import { createHash, timingSafeEqual } from "crypto";
import { getAdminDb, isAdminConfigured } from "./firebaseAdmin";
import { SNS_IDEAS } from "./collections";

export const IDEA_TEXT_MAX = 500;
export const IDEA_URL_MAX = 1000;

// トークンの照合。長さの違いで早く終わらないよう、両方を SHA-256 にしてから定数時間で比べる。
export function tokenMatches(given: string): boolean {
  const expected = process.env.IDEAS_TOKEN ?? "";
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface NewIdea {
  created: number;
  text: string;
  url?: string;
  source: "ios-share";
  status: "未仕分け";
}

// sns_ideas に1件書く。サービスアカウント(FIREBASE_SERVICE_ACCOUNT)があれば Admin SDK、
// 無ければアプリ本体と同じ公開設定(NEXT_PUBLIC_FIREBASE_*)で Firestore REST API に書く。
// 後者は Firestore のルールがブラウザからの書き込みを許している間だけ通る。
export async function writeIdea(idea: NewIdea): Promise<string> {
  if (isAdminConfigured()) {
    const ref = getAdminDb().collection(SNS_IDEAS).doc();
    await ref.set({ ...idea, id: ref.id });
    return ref.id;
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!projectId || !apiKey) throw new Error("firestore_not_configured");
  const fields: Record<string, unknown> = {
    created: { integerValue: String(idea.created) },
    text: { stringValue: idea.text },
    source: { stringValue: idea.source },
    status: { stringValue: idea.status },
  };
  if (idea.url) fields.url = { stringValue: idea.url };
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${SNS_IDEAS}`;
  const res = await fetch(`${base}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`firestore_rest_${res.status}: ${t.slice(0, 200)}`);
  }
  const body = (await res.json()) as { name?: string };
  const id = (body.name ?? "").split("/").pop() ?? "";
  return id;
}
