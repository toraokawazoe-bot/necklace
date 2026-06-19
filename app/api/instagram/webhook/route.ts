import { NextRequest } from "next/server";
import {
  handleInstagramEvent,
  verifyInstagramSignature,
  IgWebhookBody,
} from "@/lib/instagram";
import { isAdminConfigured } from "@/lib/firebaseAdmin";

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

  // サービスアカウント鍵が未設定だと Admin SDK で書けず DM を保存できない。
  // ここで 200 を返すと Meta が再送しないため、その間の DM が恒久的に取りこぼされる。
  // 「設定不備」は一過性ではないが、503 を返して再送させれば、鍵を入れた後の再送で
  // 救える（mid も未記録なので二重にもならない）。処理中の例外のみ 200 で握り潰す。
  if (!isAdminConfigured()) {
    console.error(
      "[instagram webhook] FIREBASE_SERVICE_ACCOUNT 未設定のため処理できません。503 を返して再送を促します。"
    );
    return new Response("Service Unavailable", { status: 503 });
  }

  try {
    await handleInstagramEvent(body);
  } catch (e) {
    console.error("[instagram webhook] processing error", e);
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
