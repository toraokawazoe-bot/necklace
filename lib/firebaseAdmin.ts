import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

// サーバー専用。Firestore セキュリティルールをバイパスして書き込むため、
// webhook / 送信 API などのサーバーコードは「クライアント SDK」ではなく
// この Admin SDK を使う。これによりルールを「認証必須」に締めても、
// Meta から来る webhook（Firebase の認証は持たない）が orders 等に書ける。
//
// サービスアカウント鍵は環境変数 FIREBASE_SERVICE_ACCOUNT に「JSON 文字列」で渡す。
// （Firebase Console → プロジェクト設定 → サービスアカウント → 新しい秘密鍵を生成）
// 未設定のときは getAdminDb()/getAdminAuth() を呼んだ時点で明示的に失敗させる。

let cachedApp: App | null = null;

function parseServiceAccount(raw: string): Record<string, unknown> {
  // 生 JSON でも base64 エンコード JSON でも受け付ける（Vercel の環境変数運用差を吸収）。
  const trimmed = raw.trim();
  const text = trimmed.startsWith("{")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
  return JSON.parse(text) as Record<string, unknown>;
}

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  if (existing.length > 0) {
    cachedApp = existing[0];
    return cachedApp;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT が未設定です。Firebase のサービスアカウント鍵(JSON)を環境変数に設定してください。"
    );
  }
  const sa = parseServiceAccount(raw);
  cachedApp = initializeApp({
    credential: cert({
      projectId: sa.project_id as string,
      clientEmail: sa.client_email as string,
      // JSON.parse 済みなので private_key は通常そのまま使える（この replace は no-op）。
      // env に二重エスケープ（\\n がリテラルで残る）された鍵を貼った場合の保険として残す。
      privateKey: (sa.private_key as string)?.replace(/\\n/g, "\n"),
    }),
  });
  return cachedApp;
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

// サービスアカウントが設定済みかを安全に判定する（例外を投げない）。
export function isAdminConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT;
}
