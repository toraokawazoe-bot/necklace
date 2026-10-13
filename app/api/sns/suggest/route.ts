import { NextRequest } from "next/server";
import { verifyOwner } from "@/lib/serverAuth";
import {
  CALL_TIMEOUT_MS,
  DAY_CAP,
  MAX_IMAGES,
  MAX_IMAGE_B64,
  addGeminiCalls,
  buildUserText,
  callGemini,
  markStopped,
  normalizeProduct,
  parseJson,
  readUsage,
  reserveCall,
  validateSuggestion,
  type GeminiResult,
} from "@/lib/aiSuggest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 1回目30秒 + 直し依頼1回 が収まるように
export const maxDuration = 60;

const MAX_BODY_CHARS = 4_400_000; // Vercel の本文上限(4.5MB)の手前
const DEADLINE_MS = 55_000;

const MSG = {
  unauthorized: "ログインしてから使ってください。",
  forbidden: "このアカウントでは使えません。",
  not_configured: "AIは準備中です。",
  stopped: "AIの無料枠の上限に達したため、今日はここまで。明日また使えます。",
  day: `今日はここまで(1日${DAY_CAP}回まで)。明日また使えます。`,
  minute: "少し待ってからもう一度押してください(1分に3回まで)。",
  quota: "AIの無料枠の上限に達しました。今日はここまで。明日また使えます。",
  config: "AIの設定に問題があります。とらおさんに連絡してください。",
  failed: "うまく作れませんでした。もう一度押してください。",
  consent: "「許可のない人は写っていません」にチェックしてください。",
  bad_request: "送る内容が正しくありません。写真を選び直してください。",
  too_large: "写真が大きすぎます。枚数を減らしてください。",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function fail(code: keyof typeof MSG, status: number) {
  return json({ ok: false, error: code, message: MSG[code] }, status);
}

function geminiFailure(r: Exclude<GeminiResult, { kind: "ok" }>): Response {
  if (r.kind === "quota") return fail("quota", 429);
  if (r.kind === "config") return fail("config", 502);
  if (r.kind === "timeout") return fail("failed", 504);
  return fail("failed", 502);
}

/**
 * 「写真から提案」(docs/sns-spec.md §4)。運用者本人(OWNER_UID)だけが使える。
 * POST { action: "status" } → { available, stopped, used, cap }
 * POST { images: [{ data: base64(JPEG) }], product: {color,material,length,price,oneLine}, noticeThisWeek, consent: true }
 *   → { ok: true, suggestion }
 * 受け取った写真は保存しない(Gemini に渡したら捨てる)。注文・お客さんのデータは読まない。
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  const who = await verifyOwner(req.headers.get("authorization"));
  if (!who.ok) return fail(who.error, who.status);

  const raw = await req.text().catch(() => "");
  if (raw.length > MAX_BODY_CHARS) return fail("too_large", 413);
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("not object");
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("bad_request", 400);
  }

  const available = !!process.env.GEMINI_API_KEY;

  if (body.action === "status") {
    try {
      const u = await readUsage();
      return json({ ok: true, available, stopped: u.stopped, used: u.count, cap: DAY_CAP });
    } catch (e) {
      console.error("[sns/suggest] usage read failed", (e as Error)?.message?.slice(0, 200));
      return json({ ok: true, available, stopped: false, used: null, cap: DAY_CAP });
    }
  }

  if (!available) return fail("not_configured", 503);
  if (body.consent !== true) return fail("consent", 400);

  const imgs = Array.isArray(body.images) ? (body.images as unknown[]) : [];
  if (imgs.length === 0 || imgs.length > MAX_IMAGES) return fail("bad_request", 400);
  const images: string[] = [];
  for (const it of imgs) {
    const data = it && typeof it === "object" ? (it as { data?: unknown }).data : undefined;
    if (typeof data !== "string" || data.length === 0 || data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/]+=*$/.test(data)) {
      return fail(typeof data === "string" && data.length > MAX_IMAGE_B64 ? "too_large" : "bad_request", 400);
    }
    images.push(data);
  }
  const product = normalizeProduct(body.product);
  const notice = typeof body.noticeThisWeek === "number" && Number.isFinite(body.noticeThisWeek) ? Math.max(0, Math.min(50, Math.floor(body.noticeThisWeek))) : 0;

  // 回数の確保(1日20回・1分3回・課金系エラーで止めた日)
  let reserve;
  try {
    reserve = await reserveCall(who.uid);
  } catch (e) {
    console.error("[sns/suggest] usage reserve failed", (e as Error)?.message?.slice(0, 200));
    return fail("failed", 503);
  }
  if (!reserve.ok) return fail(reserve.reason, 429);

  const parts = [
    { text: buildUserText(images.length, product, notice) },
    ...images.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })),
  ];

  let calls = 1;
  const first = await callGemini(parts, CALL_TIMEOUT_MS);
  if (first.kind !== "ok") {
    if (first.kind === "quota") await markStopped("quota").catch(() => {});
    await addGeminiCalls(calls).catch(() => {});
    return geminiFailure(first);
  }

  let result = validateSuggestion(parseJson(first.text), images.length, product);
  if (!result.ok) {
    // 1回だけ直し依頼(写真は送り直さない)。それでもだめなら終了(§4-B)。
    const remaining = DEADLINE_MS - (Date.now() - started);
    if (remaining < 5_000) {
      await addGeminiCalls(calls).catch(() => {});
      return fail("failed", 502);
    }
    calls++;
    const repair = await callGemini(
      [
        {
          text: `${buildUserText(images.length, product, notice)}

前回の出力は決まりに合っていませんでした。JSONの形を直して、指定のJSONだけを返してください。
直すところ:
${result.errors.slice(0, 20).map((x) => `- ${x}`).join("\n")}

前回の出力:
${first.text.slice(0, 12_000)}`,
        },
      ],
      Math.min(CALL_TIMEOUT_MS, remaining - 2_000)
    );
    if (repair.kind !== "ok") {
      if (repair.kind === "quota") await markStopped("quota").catch(() => {});
      await addGeminiCalls(calls).catch(() => {});
      return geminiFailure(repair);
    }
    result = validateSuggestion(parseJson(repair.text), images.length, product);
  }
  await addGeminiCalls(calls).catch(() => {});

  if (!result.ok) {
    console.error("[sns/suggest] invalid output after repair", result.errors.slice(0, 5).join(" | ").slice(0, 300));
    return fail("failed", 502);
  }
  return json({ ok: true, suggestion: result.value, used: reserve.count, cap: DAY_CAP });
}

export function GET() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
