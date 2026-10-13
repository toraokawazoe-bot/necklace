import { NextRequest } from "next/server";
import { verifyOwner } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 認証を必須にするか(注文アプリ全体と同じ切り替え。instagram/send と同じ考え方)。
const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "1";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * 「共有ボタンの設定」画面に共有用トークン(環境変数 IDEAS_TOKEN)を返す。
 * ログイン必須が有効なら、Firebase の ID トークンを Admin SDK で確かめ、
 * uid が OWNER_UID と一致する運用者だけに返す(OWNER_UID 未設定なら誰にも返さない)。
 * ログイン必須が無効な間は、アプリ本体(注文データ含む)と同じく誰でも開ける状態なので同じ扱い。
 */
export async function POST(req: NextRequest) {
  if (REQUIRE_AUTH) {
    const check = await verifyOwner(req.headers.get("authorization"));
    if (!check.ok) return json({ ok: false, error: check.error }, check.status);
  }
  const token = process.env.IDEAS_TOKEN;
  if (!token) return json({ ok: false, error: "not_configured" }, 503);
  return json({ ok: true, token });
}

export function GET() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
