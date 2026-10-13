import { NextRequest } from "next/server";
import { IDEA_TEXT_MAX, IDEA_URL_MAX, isHttpUrl, tokenMatches, writeIdea } from "@/lib/ideasServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/**
 * iPhone の共有ボタン(iOSショートカット)からアイデア箱へ送る。
 * POST { token, text?, url? }
 *   token: 環境変数 IDEAS_TOKEN と一致したときだけ受け付ける
 *   text : 500文字まで / url: 1000文字まで・http(s) のみ。どちらか1つは必須
 * sns_ideas に source="ios-share"・status="未仕分け" で1件作る。
 */
export async function POST(req: NextRequest) {
  if (!process.env.IDEAS_TOKEN) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const raw = await req.text().catch(() => "");
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return json({ ok: false, error: "too_large" }, 413);
  }
  let body: { token?: unknown; text?: unknown; url?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!tokenMatches(token)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!text && !url) {
    return json({ ok: false, error: "empty" }, 400);
  }
  if (text.length > IDEA_TEXT_MAX) {
    return json({ ok: false, error: "text_too_long", max: IDEA_TEXT_MAX }, 400);
  }
  if (url && (url.length > IDEA_URL_MAX || !isHttpUrl(url))) {
    return json({ ok: false, error: "invalid_url", max: IDEA_URL_MAX }, 400);
  }

  try {
    const id = await writeIdea({
      created: Date.now(),
      text,
      url: url || undefined,
      source: "ios-share",
      status: "未仕分け",
    });
    return json({ ok: true, id, message: "アイデア箱に入れました" });
  } catch (e) {
    console.error("[api/ideas] write failed", e);
    return json({ ok: false, error: "write_failed" }, 500);
  }
}

export function GET() {
  return json({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST" });
}
