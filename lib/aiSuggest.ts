// サーバー専用: 「写真から提案」(Gemini) の中身。docs/sns-spec.md §4 が正。
// - 受け取るのは「選んだ写真」と「商品欄の項目」と「今週の告知本数」だけ。注文・お客さんのデータはここから読まない。
// - GEMINI_API_KEY はこのファイル(サーバー)だけが読む。ログ・応答に出さない。
// - 自動の再試行ループはしない。形の不正だけ1回直し依頼をする(§4-B)。
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebaseAdmin";
import { SETTINGS } from "./collections";
import {
  CAPTION_TEMPLATES,
  FORMAT_CARDS,
  HASHTAGS,
  HOOKS,
  IG_HASHTAG_MAX,
  KNOWLEDGE,
  POST_CHECKS,
  SLIDE_NOTE,
  SLIDE_ORDER,
} from "./snsKnowledge";

// ---- 設定 ----
// モデル名は頻繁に変わるので環境変数で差し替え可能にする(§4-0)。無料枠に載っている画像入力対応の Flash 系だけを使う。
// 既定値は 2026-10-13 に ai.google.dev の models / pricing ページで「無料枠あり・画像入力可」と確認したもの。
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DAY_CAP = 20; // 1日20回まで(§4-C)
export const MINUTE_CAP = 3; // 1分に3回まで(§4-C)
export const MAX_IMAGES = 8;
export const MAX_IMAGE_B64 = 1_400_000; // 1枚 約1MB(base64で約1.4M文字)まで
export const CALL_TIMEOUT_MS = 30_000;

export const SLIDE_ROLES = ["着用", "別角度", "質感", "色展開", "長さ", "値段・買い方", "その他"] as const;
export const CHECK_RESULTS = ["OK", "NG", "不明"] as const;
export const CONFIDENCES = ["高", "中", "低", "推論"] as const;
// 出力に出てはいけない語(§3-12・§4-A-8・§4-G-7)
export const BANNED_WORDS = ["アレルギー対応", "金属アレルギー", "絶対似合う", "絶対"];

export interface ProductInput {
  color: string;
  material: string;
  length: string;
  price: string;
  oneLine: string;
}

export interface Suggestion {
  format_id: string;
  format_reason: string;
  slide_order: { image_index: number; role: string; reason: string; rule: string }[];
  missing_shots: string[];
  hook_candidates: { text: string; rule: string }[];
  caption: { tiktok: string; instagram: string };
  keyword: string;
  hashtags: { instagram: string[]; tiktok: string[] };
  checklist: { item: string; result: string; note: string }[];
  warnings: string[];
  confidence: string;
}

// ---- 出力の形(§4-B)。Gemini の structured output に渡す JSON Schema ----
export const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    format_id: { type: "string", enum: FORMAT_CARDS.map((f) => f.id) },
    format_reason: { type: "string" },
    slide_order: {
      type: "array",
      items: {
        type: "object",
        properties: {
          image_index: { type: "integer" },
          role: { type: "string", enum: [...SLIDE_ROLES] },
          reason: { type: "string" },
          rule: { type: "string" },
        },
        required: ["image_index", "role", "reason", "rule"],
      },
    },
    missing_shots: { type: "array", items: { type: "string" } },
    hook_candidates: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: { text: { type: "string" }, rule: { type: "string" } },
        required: ["text", "rule"],
      },
    },
    caption: {
      type: "object",
      properties: { tiktok: { type: "string" }, instagram: { type: "string" } },
      required: ["tiktok", "instagram"],
    },
    keyword: { type: "string" },
    hashtags: {
      type: "object",
      properties: {
        instagram: { type: "array", maxItems: IG_HASHTAG_MAX, items: { type: "string" } },
        tiktok: { type: "array", maxItems: IG_HASHTAG_MAX, items: { type: "string" } },
      },
      required: ["instagram", "tiktok"],
    },
    checklist: {
      type: "array",
      minItems: POST_CHECKS.length,
      maxItems: POST_CHECKS.length,
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          result: { type: "string", enum: [...CHECK_RESULTS] },
          note: { type: "string" },
        },
        required: ["item", "result", "note"],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: [...CONFIDENCES] },
  },
  required: [
    "format_id",
    "format_reason",
    "slide_order",
    "missing_shots",
    "hook_candidates",
    "caption",
    "keyword",
    "hashtags",
    "checklist",
    "warnings",
    "confidence",
  ],
};

// ---- システム指示(§4-A の決まり + §3 の要約) ----
function knowledgeBodies(sectionId: string): string[] {
  const s = KNOWLEDGE.find((k) => k.id === sectionId);
  return s ? s.items.map((i) => (i.title ? `${i.title}: ${i.body}` : i.body)) : [];
}

let cachedSystem: string | null = null;
export function buildSystemInstruction(): string {
  if (cachedSystem) return cachedSystem;
  const templates = CAPTION_TEMPLATES.filter((t) => ["tiktokPhoto", "tiktokVideo", "igFeed", "igReel", "notice", "gift"].indexOf(t.id) !== -1)
    .map((t) => `- ${t.name}: ${t.text.replace(/\n/g, "\\n")}`)
    .join("\n");
  const formats = FORMAT_CARDS.map(
    (f) => `- id=${f.id} / ${f.star ? "★" : ""}${f.name} / 1枚目: ${f.firstSlide} / 目的: ${f.purpose} / 場所: ${f.places} / 確度: ${f.confidence}${f.notice ? " / 告知・販売の型" : ""}`
  ).join("\n");
  const hooks = Object.keys(HOOKS)
    .map((cat) => `- ${cat}: ${HOOKS[cat as keyof typeof HOOKS].join(" / ")}`)
    .join("\n");
  const tags = HASHTAGS.map((g) => `${g.size}${g.need}(${g.tags.join(" ")})`).join(" + ");

  cachedSystem = `あなたはハンドメイドのビーズネックレス店「740NLL」(運営: しおん)のSNS投稿の提案役です。決めるのは人で、あなたは提案だけをします。
考える順番: 先に「どの型か・なぜか・誰に向けるか」を決め、そのあとで並べ方と文章を書く。順番を逆にしない。
根拠は下の「ナレッジ(§3)」だけ。§3に無いことは言わない。各判断に従ったルールの§番号を書く。

# 判断の決まり(§4-A)
1. 1枚目(§3-1①・§3-8・§3-9): 人が身に着けた姿の写真があれば必ず slide_order の先頭にし、一言の文字を乗せる案にする。無ければ warnings と missing_shots に「着用写真がありません。撮ってから投稿を」と書き、物だけの写真を1枚目として推さない(その場合も slide_order には送られた写真を並べるが、先頭の reason に「着用写真が無いので仮置き」と書く)。撮影案(服+ネックレスの自撮り/顔を切った首元)を missing_shots に出す。
2. 並べ方(§3-9): 1 着用+一言 → 2〜3 別角度・横顔 → 4 ビーズの質感 → 5 色展開・置き撮り → 6 長さが分かる写真 → 最後 値段・買い方・次の予告。5〜8枚。足りない役割は missing_shots に出す。色味が揃わない写真は warnings に出す。slide_order には送られた写真を全部、重複なく入れる。image_index は送った順の0始まり。
3. 型の選び方(§3-2): format_id は下の型カードの id から選ぶ。カードに無い型を作らない。確度が「推論」の型は confidence を「推論」にする。作っている過程の型(making)はTikTok/フィードに推さない。
4. 1枚目の文字(§3-3): hook_candidates はフック集の文をそのまま使うか数語の差し替えまで。ちょうど3案。rule にフック集のどの分類か(例「§3-3 認知・保存」)を書く。値段・長さ・地名は入力値だけ。入力が無い数字の入ったフックは使わないか【要入力】に置き換える。
5. 文章(§3-4・§3-6): caption.tiktok と caption.instagram を分けて書く。どちらも1行目(最初の20字以内)に keyword をそのまま入れる。keyword は検索語を1つ(優先: ビーズネックレス)。同じ語を詰め込まない(文章・画面の文字・タグで合計3か所まで)。
6. ハッシュタグ(§3-6): hashtags.instagram は5個まで(大1・中2・小1・自社#740NLL)。hashtags.tiktok も5個まで(文章テンプレートの範囲)。6個以上を出さない。caption にもハッシュタグを書くなら、その数も含めて Instagram は5個以内。
7. 事実を作らない: 値段・長さ・素材・色・在庫・日時は、ユーザーが入力した値だけを使う。入力が無い項目は「【要入力】」と書き、推測で埋めない。テンプレートに書かれた「2,500円」「¥2,500」も、値段の入力が無ければ【要入力】にする。入力に無い「円」「cm」の数字を書かない。写真から長さや素材を断定しない。
8. 言ってはいけない(§3-12): 「金属アレルギー対応」「アレルギー対応」「絶対似合う」「絶対」など断定の診断・効能。他ブランドを誤認させる書き方。著作権音源の指示。同じ文章の使い回し。
9. 告知の本数(§3-0・§3-11): 告知・販売だけの投稿は週1本まで。今週すでに1本以上ある場合に告知型(notice)を選ぶなら warnings に書く。
10. 文体: 平易な日本語。です・ます調かやわらかい口語。誇張・煽りなし。絵文字は多用しない。
11. 投稿前チェック(§3-8): checklist は下の10項目を同じ順・同じ文言で、OK/NG/不明 で返す。写真から判断できない項目(代替テキスト・投稿時間など)は「不明」で note に「人が確認」。
12. 確度: confidence は §3-1・§3-2 の確度表示をそのまま使い、勝手に上げない(高/中/低/推論)。
13. 理由: slide_order の各 reason は「なぜこの順番か」を1文で。rule に従った§番号(例「§3-9」)を必ず書く。format_reason は2文以内。

# ナレッジ(§3 の要約)
## §3-1 分析の結論
${knowledgeBodies("analysis").map((s) => `- ${s}`).join("\n")}
## §3-2 型カード(上ほど伸びた。★=分析で裏付け)
${formats}
## §3-3 1枚目の文字(フック集)
${hooks}
## §3-4 文章テンプレート({}は入力値で埋める。無ければ【要入力】)
${templates}
## §3-6 ハッシュタグとキーワード
- Instagramは1投稿5個まで: ${tags}
- TikTokは文章・画面の文字・声から検索語を拾う。1投稿にキーワード1つを3か所に。詰め込みはスパム扱い。
- 検索で実際に使われた語: ビーズネックレス(最重要)/差し色ネックレス/プチプラ アクセサリー/ビーズアクセ/ウィメンズ ネックレス
## §3-8 投稿前チェック(10)
${POST_CHECKS.map((c, i) => `${i + 1}. ${c}`).join("\n")}
## §3-9 写真スライドの並べ方
${SLIDE_ORDER.join(" / ")}。${SLIDE_NOTE}
## §3-11 投稿の柱
${knowledgeBodies("pillars").join(" ")}
## §3-12 やってはいけない
${knowledgeBodies("donts").join(" / ")}

出力は指定のJSONだけ。自由文は書かない。`;
  return cachedSystem;
}

// ---- 入力 ----
function cleanField(v: unknown): string {
  return typeof v === "string" ? v.replace(/[\r\n\t]+/g, " ").trim().slice(0, 60) : "";
}

export function normalizeProduct(raw: unknown): ProductInput {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    color: cleanField(r.color),
    material: cleanField(r.material),
    length: cleanField(r.length),
    price: cleanField(r.price),
    oneLine: cleanField(r.oneLine),
  };
}

export function buildUserText(n: number, p: ProductInput, noticeThisWeek: number): string {
  const v = (s: string) => (s ? s : "【未入力】");
  return `写真は${n}枚です(送った順に image_index 0〜${n - 1})。
商品欄(ユーザーの入力。これ以外の事実は使わない):
- 色: ${v(p.color)}
- 素材: ${v(p.material)}
- 長さ: ${v(p.length)}
- 値段: ${v(p.price)}
- 一言: ${v(p.oneLine)}
今週すでに出した告知・販売の投稿: ${noticeThisWeek}本(上限は週1本)。
決まり(§4-A)に従い、まず型・理由・誰に向けるかを決めてから、指定のJSONで提案してください。`;
}

// ---- 検証(§4-B アプリ側の検証) ----
function toHalf(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[，,]/g, "");
}

function numbersIn(s: string): string[] {
  const out: string[] = [];
  const t = toHalf(s);
  const re = /\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) out.push(String(Number(m[0])));
  return out;
}

// 文中の「円」「cm」「¥」に付いた数字
function moneyLengthNumbers(s: string): string[] {
  const out: string[] = [];
  const t = toHalf(s);
  const re = /[¥￥]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:円|cm|ｃｍ|CM|センチ)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) out.push(String(Number(m[1] ?? m[2])));
  return out;
}

const squash = (s: string) => s.replace(/\s+/g, "");

function isStr(v: unknown): v is string {
  return typeof v === "string";
}
function isStrArr(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isStr);
}

export function validateSuggestion(
  raw: unknown,
  n: number,
  product: ProductInput
): { ok: true; value: Suggestion } | { ok: false; errors: string[] } {
  const e: string[] = [];
  if (!raw || typeof raw !== "object") return { ok: false, errors: ["JSONのオブジェクトではありません"] };
  const r = raw as Record<string, unknown>;

  if (!isStr(r.format_id) || !FORMAT_CARDS.some((f) => f.id === r.format_id)) e.push("format_id が型カードのidではありません");
  if (!isStr(r.format_reason) || !r.format_reason.trim()) e.push("format_reason がありません");

  const slides = Array.isArray(r.slide_order) ? (r.slide_order as unknown[]) : null;
  if (!slides || slides.length === 0) e.push("slide_order がありません");
  else {
    const seen = new Set<number>();
    slides.forEach((s, i) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const idx = o.image_index;
      if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= n) e.push(`slide_order[${i}].image_index が範囲外です(0〜${n - 1})`);
      else if (seen.has(idx)) e.push(`slide_order の image_index ${idx} が重複しています`);
      else seen.add(idx);
      if (!isStr(o.role) || (SLIDE_ROLES as readonly string[]).indexOf(o.role) === -1) e.push(`slide_order[${i}].role が不正です`);
      if (!isStr(o.reason)) e.push(`slide_order[${i}].reason がありません`);
      if (!isStr(o.rule)) e.push(`slide_order[${i}].rule がありません`);
    });
  }

  if (!isStrArr(r.missing_shots)) e.push("missing_shots が文字列の配列ではありません");

  const hooks = Array.isArray(r.hook_candidates) ? (r.hook_candidates as unknown[]) : null;
  if (!hooks || hooks.length !== 3) e.push("hook_candidates はちょうど3件にしてください");
  else hooks.forEach((h, i) => {
    const o = (h ?? {}) as Record<string, unknown>;
    if (!isStr(o.text) || !o.text.trim()) e.push(`hook_candidates[${i}].text がありません`);
    if (!isStr(o.rule)) e.push(`hook_candidates[${i}].rule がありません`);
  });

  const cap = (r.caption ?? null) as Record<string, unknown> | null;
  if (!cap || !isStr(cap.tiktok) || !isStr(cap.instagram)) e.push("caption.tiktok / caption.instagram がありません");

  const kw = isStr(r.keyword) ? r.keyword.trim() : "";
  if (!kw) e.push("keyword がありません");

  const ht = (r.hashtags ?? null) as Record<string, unknown> | null;
  if (!ht || !isStrArr(ht.instagram) || !isStrArr(ht.tiktok)) e.push("hashtags.instagram / hashtags.tiktok がありません");
  else {
    if ((ht.instagram as string[]).length > IG_HASHTAG_MAX) e.push(`hashtags.instagram は${IG_HASHTAG_MAX}個以下にしてください`);
    if ((ht.tiktok as string[]).length > IG_HASHTAG_MAX) e.push(`hashtags.tiktok は${IG_HASHTAG_MAX}個以下にしてください`);
  }

  const checks = Array.isArray(r.checklist) ? (r.checklist as unknown[]) : null;
  if (!checks || checks.length !== POST_CHECKS.length) e.push(`checklist はちょうど${POST_CHECKS.length}件にしてください`);
  else checks.forEach((c, i) => {
    const o = (c ?? {}) as Record<string, unknown>;
    if (!isStr(o.item)) e.push(`checklist[${i}].item がありません`);
    if (!isStr(o.result) || (CHECK_RESULTS as readonly string[]).indexOf(o.result) === -1) e.push(`checklist[${i}].result は OK/NG/不明 のどれかにしてください`);
    if (o.note !== undefined && !isStr(o.note)) e.push(`checklist[${i}].note が文字列ではありません`);
  });

  if (!isStrArr(r.warnings)) e.push("warnings が文字列の配列ではありません");
  if (!isStr(r.confidence) || (CONFIDENCES as readonly string[]).indexOf(r.confidence) === -1) e.push("confidence は 高/中/低/推論 のどれかにしてください");

  // ここから中身の検証(形が通っているときだけ)
  if (e.length === 0) {
    const c = cap as { tiktok: string; instagram: string };
    const hookTexts = (hooks as { text: string }[]).map((h) => h.text);
    const igTagsInCaption = (c.instagram.match(/#[^\s#]+/g) ?? []).length;
    if (igTagsInCaption > IG_HASHTAG_MAX) e.push(`caption.instagram のハッシュタグが${IG_HASHTAG_MAX}個を超えています`);

    // keyword が各 caption の1行目(または最初の20字)に入っているか
    const k = squash(kw);
    for (const [name, text] of [
      ["tiktok", c.tiktok],
      ["instagram", c.instagram],
    ] as const) {
      const first = squash(text.split("\n")[0] ?? "");
      const at = squash(text).indexOf(k);
      if (first.indexOf(k) === -1 && !(at >= 0 && at < 20)) e.push(`caption.${name} の1行目に keyword「${kw}」を入れてください`);
    }

    // 入力していない数字(円・cm)が出ていないか
    const allowed = new Set([...numbersIn(product.price), ...numbersIn(product.length)]);
    for (const [name, text] of [
      ["caption.tiktok", c.tiktok],
      ["caption.instagram", c.instagram],
      ...hookTexts.map((t, i) => [`hook_candidates[${i}]`, t] as const),
    ] as const) {
      const bad = moneyLengthNumbers(text).filter((x) => !allowed.has(x));
      if (bad.length) e.push(`${name} に入力していない数字(${bad.join("・")})があります。【要入力】にしてください`);
    }

    // 禁止語
    const texts = [c.tiktok, c.instagram, ...hookTexts, ...((ht as { instagram: string[]; tiktok: string[] }).instagram), ...((ht as { tiktok: string[] }).tiktok)];
    for (const w of BANNED_WORDS) {
      if (texts.some((t) => t.indexOf(w) !== -1)) e.push(`禁止語「${w}」を使わないでください`);
    }
  }

  if (e.length) return { ok: false, errors: e };
  const s = r as unknown as Suggestion;
  return {
    ok: true,
    value: {
      ...s,
      keyword: kw,
      checklist: s.checklist.map((x) => ({ item: x.item, result: x.result, note: x.note ?? "" })),
    },
  };
}

// ---- Gemini 呼び出し ----
export type GeminiResult =
  | { kind: "ok"; text: string }
  | { kind: "quota" } // 429 / RESOURCE_EXHAUSTED / 課金関連 → その日は止める
  | { kind: "config" } // キー不正・モデル名不正など(人が直す)
  | { kind: "timeout" }
  | { kind: "blocked" } // 安全フィルタ等で本文が無い
  | { kind: "error"; status: number };

export function geminiModel(): string {
  const m = (process.env.GEMINI_MODEL ?? "").trim();
  return /^[a-z0-9.\-]+$/i.test(m) ? m : DEFAULT_GEMINI_MODEL;
}

function thinkingConfig(model: string): Record<string, unknown> | undefined {
  // 2.5 系は thinkingBudget、3 系以降は thinkingLevel。速さ優先で軽くする(30秒の上限があるため)。
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-[3-9]/.test(model)) return { thinkingLevel: "low" };
  return undefined;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function callGemini(parts: Part[], timeoutMs: number): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { kind: "config" };
  const model = geminiModel();
  const thinking = thinkingConfig(model);
  const body = {
    systemInstruction: { parts: [{ text: buildSystemInstruction() }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
      ...(thinking ? { thinkingConfig: thinking } : {}),
    },
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs));
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      // キーは URL ではなくヘッダーで渡す(URL はログに残りやすいため)
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      let status = "";
      let message = "";
      try {
        const j = JSON.parse(text) as { error?: { status?: string; message?: string } };
        status = j.error?.status ?? "";
        message = j.error?.message ?? "";
      } catch {
        /* 本文が JSON でない */
      }
      // 本文(写真)やキーは出さない。状態だけ残す。
      console.error("[sns/suggest] gemini error", res.status, status, message.slice(0, 200));
      if (res.status === 429 || status === "RESOURCE_EXHAUSTED" || /billing|quota|exceeded/i.test(message)) return { kind: "quota" };
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) return { kind: "config" };
      return { kind: "error", status: res.status };
    }
    const j = JSON.parse(text) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    };
    const out = (j.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
    if (!out.trim()) return { kind: "blocked" };
    return { kind: "ok", text: out };
  } catch (e) {
    if ((e as { name?: string } | null)?.name === "AbortError") return { kind: "timeout" };
    console.error("[sns/suggest] gemini fetch failed", (e as Error)?.message?.slice(0, 200));
    return { kind: "error", status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// ---- 回数の記録(Firestore・Admin SDK)。settings/ai_usage/days/{YYYY-MM-DD 日本時間} ----
export function jstToday(now = Date.now()): string {
  const d = new Date(now + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function usageRef(date: string) {
  return getAdminDb().collection(SETTINGS).doc("ai_usage").collection("days").doc(date);
}

export interface UsageState {
  count: number;
  stopped: boolean;
}

export async function readUsage(now = Date.now()): Promise<UsageState> {
  const snap = await usageRef(jstToday(now)).get();
  const d = (snap.exists ? snap.data() : {}) as { count?: number; stopped?: boolean };
  return { count: typeof d.count === "number" ? d.count : 0, stopped: d.stopped === true };
}

export type Reserve = { ok: true; count: number } | { ok: false; reason: "stopped" | "day" | "minute" };

// 呼ぶ前に1回分を確保する(失敗しても数える=無料枠に対して保守的)。
export async function reserveCall(uid: string, now = Date.now()): Promise<Reserve> {
  const ref = usageRef(jstToday(now));
  return getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = (snap.exists ? snap.data() : {}) as { count?: number; stopped?: boolean; recent?: number[] };
    if (d.stopped === true) return { ok: false, reason: "stopped" } as Reserve;
    const count = typeof d.count === "number" ? d.count : 0;
    if (count >= DAY_CAP) return { ok: false, reason: "day" } as Reserve;
    const recent = (Array.isArray(d.recent) ? d.recent : []).filter((t) => typeof t === "number" && now - t < 60_000);
    if (recent.length >= MINUTE_CAP) return { ok: false, reason: "minute" } as Reserve;
    tx.set(ref, { count: count + 1, recent: [...recent, now], uid, updatedAt: now }, { merge: true });
    return { ok: true, count: count + 1 } as Reserve;
  });
}

export async function addGeminiCalls(n: number, now = Date.now()): Promise<void> {
  await usageRef(jstToday(now)).set({ geminiCalls: FieldValue.increment(n), updatedAt: now }, { merge: true });
}

export async function markStopped(reason: string, now = Date.now()): Promise<void> {
  await usageRef(jstToday(now)).set({ stopped: true, stoppedReason: reason, stoppedAt: now, updatedAt: now }, { merge: true });
}
