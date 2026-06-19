import { NextRequest } from "next/server";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendInstagramMessage } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IG_MESSAGES = "ig_messages";
const IG_CONVERSATIONS = "ig_conversations";

// テキストDMの上限（Send API の仕様）
const MAX_TEXT_BYTES = 1000;

/**
 * DM 返信の送信（POST）。
 * body: { recipientId: string(IGSID), text: string }
 * トークンはサーバー専用の INSTAGRAM_ACCESS_TOKEN を使い、ブラウザには絶対に渡さない。
 * Graph 送信が 2xx を返したときだけ、送信済みメッセージを Firestore に書く
 * （失敗時に「幻の送信バブル」を残さないため）。
 */
export async function POST(req: NextRequest) {
  let body: { recipientId?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: { code: "bad_request" } }, { status: 400 });
  }

  const recipientId =
    typeof body.recipientId === "string" ? body.recipientId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!recipientId) {
    return Response.json(
      { ok: false, error: { code: "recipient_required" } },
      { status: 400 }
    );
  }
  if (!text) {
    return Response.json(
      { ok: false, error: { code: "text_required" } },
      { status: 400 }
    );
  }
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    return Response.json(
      { ok: false, error: { code: "too_long" } },
      { status: 400 }
    );
  }

  const result = await sendInstagramMessage(recipientId, text);
  if (!result.ok) {
    const status =
      result.status >= 400 && result.status < 600 ? result.status : 502;
    return Response.json({ ok: false, error: result.error }, { status });
  }

  // 送信成功後のみ書き込む。doc id は Graph 返却の message_id（無ければフォールバック）。
  const now = Date.now();
  const id = result.messageId || `out_${recipientId}_${now}`;
  try {
    await setDoc(doc(db, IG_MESSAGES, id), {
      id,
      threadId: recipientId,
      senderId: "",
      recipientId,
      text,
      summary: text,
      attachments: [],
      ts: now,
      createdAt: now,
      direction: "out",
    });
    // 受信側の lastText/lastTs は上書きしない（受信プレビューの意味を保つため、out 専用フィールドに記録）。
    await setDoc(
      doc(db, IG_CONVERSATIONS, recipientId),
      { lastOutText: text, lastOutTs: now, updatedAt: now },
      { merge: true }
    );
  } catch (e) {
    // 送信自体は成功しているので 200 を返す。記録の失敗だけログに残す。
    console.error("[instagram send] firestore write failed", e);
  }

  return Response.json({ ok: true, messageId: id });
}
