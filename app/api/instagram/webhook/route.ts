import { NextRequest } from "next/server";
import {
  handleInstagramEvent,
  verifyInstagramSignature,
  IgWebhookBody,
} from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook 検証（GET）。
 * Meta が hub.mode / hub.verify_token / hub.challenge を付けて GET してくるので、
 * verify_token が一致したら challenge をそのまま返す。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;

  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * イベント受信（POST）。
 * 署名を検証し、DM を Firestore に保存 → 受信トレイにカードを自動生成する。
 * Meta が購読を無効化しないよう、処理に失敗しても常に 200 を返す。
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const signature = req.headers.get("x-hub-signature-256");
  if (appSecret) {
    if (!verifyInstagramSignature(raw, signature, appSecret)) {
      return new Response("Invalid signature", { status: 403 });
    }
  } else {
    console.warn(
      "[instagram webhook] INSTAGRAM_APP_SECRET 未設定のため署名検証をスキップしています（開発用）"
    );
  }

  let body: IgWebhookBody;
  try {
    body = JSON.parse(raw) as IgWebhookBody;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    await handleInstagramEvent(body);
  } catch (e) {
    console.error("[instagram webhook] processing error", e);
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
