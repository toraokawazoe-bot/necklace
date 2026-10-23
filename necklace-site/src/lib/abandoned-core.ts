// 「決済画面まで来て払わずに終わった」セッションの記録を組み立てる部品(Redis にも Next にも依存しない)。
// scripts/analyze-abandoned.mjs からも Node の型除去実行でそのまま読めるよう、
// 相対 import・エイリアス import・enum を使わない。Stripe の型は import type(実行時に消える)だけ。
import type Stripe from "stripe";

// ---------- 型 ----------

export type AttemptKind = "card" | "paypay" | "other";

// 支払いを試した1回分。Stripe の Charge から作る(失敗した試行も Charge として残る)。
export type PayAttempt = {
  at: number; // ms
  method: string; // card / paypay / ...
  ok: boolean;
  code: string | null; // failure_code / decline_code
  message: string | null; // Stripe の英語メッセージ(原文)
  reasonJa: string; // 日本語訳
  riskLevel: string | null; // Radar の評価 (normal / elevated / highest)
  outcomeType: string | null; // authorized / issuer_declined / blocked / invalid
  cardBrand: string | null;
  cardFunding: string | null; // credit / debit / prepaid
  cardCountry: string | null;
  threeDS: string | null; // 3Dセキュアの結果 (authenticated / failed / not_supported ...)
};

export type DeviceInfo = {
  os: string; // iOS / Android / Mac / Windows / 不明
  app: string; // Instagram / Threads / LINE / Facebook / X / Safari・Chrome等 / 不明
  inApp: boolean; // アプリ内ブラウザか
  mobile: boolean;
};

export type AbandonedOutcome = "expired" | "failed" | "paid" | "open";

export type AbandonedRecord = {
  sessionId: string;
  createdAt: number; // セッションを作った時刻(ms)。= 決済画面を開いた時刻
  expiresAt: number | null;
  endedAt: number | null; // 期限切れ/失敗が確定した時刻
  outcome: AbandonedOutcome;
  // 戻るボタンで /checkout/cancel に戻ってきた時刻(自前のキャンセル API が記録)。
  backAt?: number;
  expiredByApi?: boolean;
  amount: number;
  currency: string;
  items: { name: string; qty: number; size?: string }[];
  couponCode?: string;
  discountAmount?: number;
  methodsOffered: string[]; // 画面に出ていた支払方法
  // PayPay が使えずカードのみで作り直したセッションか。
  // 作成時は確実に記録、過去分は「methodsOffered が card だけ」からの推定。
  cardOnly: boolean;
  cardOnlyInferred?: boolean;
  // 入力の進み具合(Stripe が保持しているもの)
  progress: {
    email: boolean;
    name: boolean;
    phone: boolean;
    address: boolean;
  };
  email: string | null; // 管理画面専用(個人情報)
  paymentIntentId: string | null;
  piStatus: string | null;
  piCancellation: string | null; // 期限切れによる自動キャンセル等
  payMethod: string | null; // 最後に使われた/選ばれた方法
  attempts: PayAttempt[];
  // 自前の計測(作成時のみ)
  device?: DeviceInfo;
  referrer?: string; // 最初の流入元(例: l.threads.com)
  source: "live" | "backfill";
  updatedAt: number;
};

// ---------- 表示用の判定 ----------

export type StageKey =
  | "paid"
  | "viewed_only"
  | "email"
  | "address"
  | "attempt_failed"
  | "paypay_left"
  | "attempt_started";

export const STAGE_LABEL: Record<StageKey, string> = {
  paid: "決済完了",
  viewed_only: "決済画面を開いただけ",
  email: "メールまで入力",
  address: "住所まで入力",
  attempt_failed: "支払いを試して失敗",
  paypay_left: "PayPayへ移動して戻らず",
  attempt_started: "支払い手続きを始めて中断",
};

export const STAGE_ORDER: StageKey[] = [
  "viewed_only",
  "email",
  "address",
  "attempt_started",
  "paypay_left",
  "attempt_failed",
  "paid",
];

export function deriveStage(r: AbandonedRecord): StageKey {
  if (r.outcome === "paid") return "paid";
  const failed = r.attempts.filter((a) => !a.ok);
  if (failed.length > 0) return "attempt_failed";
  if (r.payMethod === "paypay" && r.paymentIntentId) return "paypay_left";
  if (r.paymentIntentId && r.payMethod) return "attempt_started";
  if (r.progress.address) return "address";
  if (r.progress.email) return "email";
  return "viewed_only";
}

// 終わり方(戻る/時間切れ)の推定。
// - 戻るボタン: /checkout/cancel に戻ってきたことを自前で記録している
// - 時間切れ: 期限(expires_at)までセッションが生きていた
export type EndKind = "back_button" | "timeout" | "unknown";
export const END_LABEL: Record<EndKind, string> = {
  back_button: "戻るボタンで中断",
  timeout: "放置して期限切れ",
  unknown: "不明(戻ったか放置したか区別できない)",
};
export function deriveEnd(r: AbandonedRecord): EndKind {
  if (r.outcome === "paid") return "unknown";
  if (r.backAt) return "back_button";
  if (r.outcome === "expired" && r.expiredByApi === true) return "back_button";
  if (r.outcome === "expired" && r.expiredByApi === false) return "timeout";
  if (r.outcome === "expired" && r.expiresAt && r.endedAt) {
    // 期限の前後2分以内に確定 → 放置。それより早ければ誰か(戻る操作)が閉じた。
    if (r.endedAt >= r.expiresAt * 1000 - 120_000) return "timeout";
    return "back_button";
  }
  return "unknown";
}

// ---------- 失敗理由の日本語訳 ----------

const REASON_JA: Record<string, string> = {
  // カード
  card_declined: "カード会社に拒否された(理由は非開示)",
  generic_decline: "カード会社に拒否された(理由は非開示)",
  do_not_honor: "カード会社に拒否された(理由は非開示)",
  insufficient_funds: "残高・利用枠が足りない",
  expired_card: "カードの有効期限切れ",
  incorrect_cvc: "セキュリティコードが違う",
  invalid_cvc: "セキュリティコードが違う",
  incorrect_number: "カード番号が違う",
  invalid_number: "カード番号が違う",
  invalid_expiry_month: "有効期限(月)が違う",
  invalid_expiry_year: "有効期限(年)が違う",
  incorrect_zip: "郵便番号が一致しない",
  processing_error: "処理エラー(一時的な障害)",
  try_again_later: "時間をおいて再試行を求められた",
  authentication_required: "3Dセキュア(本人認証)が必要だった",
  payment_intent_authentication_failure: "3Dセキュア(本人認証)に失敗・中断",
  card_velocity_exceeded: "短時間に試行しすぎ(カード会社の制限)",
  withdrawal_count_limit_exceeded: "利用回数の上限超過",
  fraudulent: "不正利用の疑いで拒否",
  lost_card: "紛失カードとして拒否",
  stolen_card: "盗難カードとして拒否",
  pickup_card: "カード会社がカードの利用を停止",
  restricted_card: "カードの利用が制限されている",
  call_issuer: "カード会社への問い合わせを要求された",
  not_permitted: "このカードでは許可されていない取引",
  card_not_supported: "このカードは対応外(例: 取引種別)",
  currency_not_supported: "このカードは日本円に非対応",
  testmode_decline: "テスト用カードの拒否",
  // 決済全般
  payment_intent_payment_attempt_failed: "支払いの試行が失敗",
  payment_method_unactivated: "この支払方法はまだ有効化されていない",
  payment_method_provider_decline: "決済事業者(PayPay等)に拒否された",
  payment_method_provider_timeout: "決済事業者(PayPay等)の応答待ちでタイムアウト",
  payment_method_customer_decline: "お客様が決済事業者の画面で拒否・キャンセル",
  payment_method_not_available: "この支払方法は今使えない",
  payment_method_microdeposit_failed: "認証用の少額入金に失敗",
  payment_intent_unexpected_state: "決済の状態が不正(二重操作など)",
  amount_too_large: "金額が大きすぎる",
  amount_too_small: "金額が小さすぎる",
  email_invalid: "メールアドレスが不正",
  // Radar
  blocked: "Stripeの不正検知(Radar)がブロック",
};

export function reasonJa(code: string | null, message: string | null): string {
  if (code && REASON_JA[code]) return REASON_JA[code];
  if (code) return `${code}(未翻訳のコード)`;
  if (message) return message;
  return "理由の記録なし";
}

export function methodLabel(m: string | null): string {
  switch (m) {
    case "card":
      return "カード";
    case "paypay":
      return "PayPay";
    case null:
    case undefined:
      return "—";
    default:
      return m;
  }
}

// ---------- 端末の判定(User-Agent) ----------

export function classifyUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  if (!s) return { os: "不明", app: "不明", inApp: false, mobile: false };
  let os = "不明";
  if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/Macintosh|Mac OS X/i.test(s)) os = "Mac";
  else if (/Windows/i.test(s)) os = "Windows";
  else if (/Linux/i.test(s)) os = "Linux";
  const mobile = os === "iOS" || os === "Android";

  let app: string | null = null;
  // Threads の iOS アプリ内ブラウザは UA に "Barcelona"(社内コード名)が入る。
  if (/Barcelona/i.test(s) || /Threads/i.test(s)) app = "Threads";
  else if (/Instagram/i.test(s)) app = "Instagram";
  else if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(s)) app = "Facebook";
  else if (/\bLine\//i.test(s) || /\bLIFF\b/i.test(s)) app = "LINE";
  else if (/Twitter|TwitterAndroid|\bX\//i.test(s)) app = "X";
  else if (/TikTok|musical_ly|BytedanceWebview/i.test(s)) app = "TikTok";
  const inApp = app !== null;
  if (!app) {
    if (/CriOS|Chrome\//i.test(s)) app = "Chrome";
    else if (/FxiOS|Firefox/i.test(s)) app = "Firefox";
    else if (/EdgiOS|Edg\//i.test(s)) app = "Edge";
    else if (/Safari/i.test(s)) app = "Safari";
    else app = "不明";
  }
  return { os, app, inApp, mobile };
}

// ---------- Stripe → 記録 ----------

const PAYMENT_PROGRESS_STATUS = new Set([
  "requires_action",
  "requires_confirmation",
  "processing",
  "requires_capture",
  "succeeded",
  "canceled",
]);

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

function attemptFromCharge(c: Stripe.Charge): PayAttempt {
  const pmd = c.payment_method_details as
    | (Stripe.Charge.PaymentMethodDetails & Record<string, unknown>)
    | null
    | undefined;
  const method = pmd?.type ?? "other";
  const card = pmd?.card ?? null;
  const code = c.failure_code ?? null;
  const out = c.outcome;
  // Radar にブロックされた場合は failure_code が card_declined になるので、outcome を優先して見分ける
  const finalCode = out?.type === "blocked" ? "blocked" : code;
  return {
    at: c.created * 1000,
    method,
    ok: c.status === "succeeded",
    code: finalCode,
    message: c.failure_message ?? out?.seller_message ?? null,
    reasonJa:
      c.status === "succeeded"
        ? "成功"
        : reasonJa(finalCode, c.failure_message ?? out?.seller_message ?? null),
    riskLevel: out?.risk_level ?? null,
    outcomeType: out?.type ?? null,
    cardBrand: card?.brand ?? null,
    cardFunding: card?.funding ?? null,
    cardCountry: card?.country ?? null,
    threeDS: card?.three_d_secure?.result ?? null,
  };
}

// PaymentIntent の last_payment_error から1件(Charge が無い失敗用。PayPay 等)
function attemptFromPaymentError(
  e: Stripe.PaymentIntent.LastPaymentError,
  at: number,
  method: string,
): PayAttempt {
  const code = e.decline_code ?? e.code ?? null;
  return {
    at,
    method: e.payment_method?.type ?? method,
    ok: false,
    code,
    message: e.message ?? null,
    reasonJa: reasonJa(code, e.message ?? null),
    riskLevel: null,
    outcomeType: null,
    cardBrand: e.payment_method?.card?.brand ?? null,
    cardFunding: e.payment_method?.card?.funding ?? null,
    cardCountry: e.payment_method?.card?.country ?? null,
    threeDS: null,
  };
}

export type SessionDetail = {
  session: Stripe.Checkout.Session;
  intent: Stripe.PaymentIntent | null;
  charges: Stripe.Charge[];
  // line_summary(metadata)の商品 ID → 商品名。取れなければ ID のまま表示する。
  productNames?: Record<string, string>;
};

// Stripe から、1セッション分の「どこまで進んだか」の材料を集める(読み取りだけ)。
// session は payment_intent を展開していなくてもよい。
export async function fetchSessionDetail(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<SessionDetail> {
  const intentId = idOf(session.payment_intent as string | Stripe.PaymentIntent | null);
  let intent: Stripe.PaymentIntent | null = null;
  let charges: Stripe.Charge[] = [];
  if (intentId) {
    if (session.payment_intent && typeof session.payment_intent === "object") {
      intent = session.payment_intent;
    } else {
      intent = await stripe.paymentIntents.retrieve(intentId, {
        expand: ["payment_method"],
      });
    }
    const list = await stripe.charges.list({ payment_intent: intentId, limit: 20 });
    charges = list.data;
  }
  return { session, intent, charges };
}

// metadata.line_summary は "商品ID:長さ,商品ID:長さ"、stock_N は "商品ID:数量"(N は行の番号)。
function parseItems(
  md: Record<string, string>,
  names: Record<string, string> | undefined,
): { name: string; qty: number; size?: string }[] {
  const summary = md.line_summary;
  if (!summary) return [];
  return summary
    .split(",")
    .filter(Boolean)
    .map((p, i) => {
      const [id, size] = p.split(":");
      const qty = Number((md[`stock_${i}`] ?? "").split(":")[1]) || 1;
      return {
        name: names?.[id] ?? id,
        qty,
        ...(size && Number(size) > 0 ? { size: `${size}cm` } : {}),
      };
    });
}

export function buildRecord(
  d: SessionDetail,
  base?: Partial<AbandonedRecord>,
): AbandonedRecord {
  const s = d.session;
  const md = s.metadata ?? {};
  const email = s.customer_details?.email ?? s.customer_email ?? null;
  const addr =
    s.collected_information?.shipping_details?.address ?? s.customer_details?.address ?? null;
  const methods = (s.payment_method_types ?? []) as string[];

  const attempts: PayAttempt[] = d.charges
    .slice()
    .sort((a, b) => a.created - b.created)
    .map(attemptFromCharge);

  // Charge が1件も無いのに PaymentIntent にエラーが残っている(PayPay の失敗・中断など)場合
  const lpe = d.intent?.last_payment_error ?? null;
  const intentMethod =
    (d.intent?.payment_method && typeof d.intent.payment_method === "object"
      ? d.intent.payment_method.type
      : null) ?? null;
  if (lpe && attempts.every((a) => a.ok)) {
    attempts.push(
      attemptFromPaymentError(lpe, (d.intent?.created ?? s.created) * 1000, intentMethod ?? "other"),
    );
  }

  const lastAttemptMethod = attempts.length ? attempts[attempts.length - 1].method : null;
  let payMethod = lastAttemptMethod ?? intentMethod;
  if (!payMethod && d.intent?.next_action) {
    // 支払方法が確定していなくても、リダイレクト先が PayPay なら分かる
    const na = d.intent.next_action as unknown as { type?: string };
    if (na.type && /paypay/i.test(na.type)) payMethod = "paypay";
  }
  if (!payMethod && d.intent && PAYMENT_PROGRESS_STATUS.has(d.intent.status) && methods.length === 1) {
    payMethod = methods[0];
  }

  const outcome: AbandonedOutcome =
    s.payment_status === "paid"
      ? "paid"
      : s.status === "expired"
        ? "expired"
        : s.status === "complete"
          ? "failed" // 画面は終えたが非同期の支払いが失敗した
          : "open";

  const cardOnly = methods.length === 1 && methods[0] === "card";

  const discount = s.total_details?.amount_discount ?? 0;
  const rec: AbandonedRecord = {
    sessionId: s.id,
    createdAt: s.created * 1000,
    expiresAt: s.expires_at ?? null,
    endedAt: outcome === "expired" || outcome === "failed" ? (base?.endedAt ?? null) : null,
    outcome,
    amount: s.amount_total ?? 0,
    currency: s.currency ?? "jpy",
    items: parseItems(md, d.productNames),
    ...(md.coupon_code ? { couponCode: md.coupon_code } : {}),
    ...(discount > 0 ? { discountAmount: discount } : {}),
    methodsOffered: methods,
    cardOnly,
    cardOnlyInferred: true,
    progress: {
      email: Boolean(email),
      name: Boolean(s.customer_details?.name),
      phone: Boolean(s.customer_details?.phone),
      address: Boolean(addr && (addr.line1 || addr.postal_code)),
    },
    email,
    paymentIntentId: d.intent?.id ?? null,
    piStatus: d.intent?.status ?? null,
    piCancellation: d.intent?.cancellation_reason ?? null,
    payMethod,
    attempts,
    source: "backfill",
    updatedAt: Date.now(),
  };
  // 作成時に自前で記録した値(端末・流入元・戻る・カードのみ確定)を優先して引き継ぐ。
  if (base) {
    if (base.device) rec.device = base.device;
    if (base.referrer) rec.referrer = base.referrer;
    if (base.backAt) rec.backAt = base.backAt;
    if (base.expiredByApi !== undefined) rec.expiredByApi = base.expiredByApi;
    if (base.source === "live") rec.source = "live";
    if (base.cardOnlyInferred === false) {
      rec.cardOnly = base.cardOnly ?? rec.cardOnly;
      rec.cardOnlyInferred = false;
    }
    // 取れている個人入力は、後から消えても失わない
    if (base.email && !rec.email) rec.email = base.email;
    rec.progress = {
      email: rec.progress.email || Boolean(base.progress?.email),
      name: rec.progress.name || Boolean(base.progress?.name),
      phone: rec.progress.phone || Boolean(base.progress?.phone),
      address: rec.progress.address || Boolean(base.progress?.address),
    };
    // 別経路で記録済みの試行は、同じ時刻・方法なら重ねない
    if (base.attempts?.length) {
      const key = (a: PayAttempt) => `${a.at}:${a.method}:${a.code ?? ""}`;
      const have = new Set(rec.attempts.map(key));
      for (const a of base.attempts) if (!have.has(key(a))) rec.attempts.push(a);
      rec.attempts.sort((x, y) => x.at - y.at);
    }
  }
  return rec;
}


// ---------- 集計 ----------

export type Tally = { key: string; count: number }[];

function tally(values: (string | null | undefined)[]): Tally {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = v && v.length ? v : "(不明)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function jstHour(ms: number): number {
  return new Date(ms + 9 * 3600_000).getUTCHours();
}

export type AbandonedSummary = {
  total: number;
  byStage: Tally;
  byEnd: Tally;
  byReason: Tally; // 失敗した試行の理由(1件に複数あれば全部数える)
  byMethod: Tally; // 支払方法(最後に選んだもの。選ばなかった=「選ばず」)
  byDevice: Tally;
  byApp: Tally;
  byReferrer: Tally;
  byHour: { hour: number; count: number }[];
  byAmount: Tally;
  cardOnlyCount: number;
  withCoupon: number;
  attemptedCount: number; // 支払いを試した(PaymentIntent まで進んだ)件数
  emailEnteredCount: number;
  repeatPeople: { email: string; count: number }[];
  durationMinutes: { median: number | null; p90: number | null };
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[i];
}

export function summarize(records: AbandonedRecord[]): AbandonedSummary {
  const rs = records.filter((r) => r.outcome !== "paid");
  const hours = new Array(24).fill(0) as number[];
  for (const r of rs) hours[jstHour(r.createdAt)]++;
  const emailCount = new Map<string, number>();
  for (const r of rs) {
    if (r.email) {
      const k = r.email.toLowerCase();
      emailCount.set(k, (emailCount.get(k) ?? 0) + 1);
    }
  }
  const durations = rs
    .filter((r) => r.endedAt)
    .map((r) => Math.round(((r.endedAt as number) - r.createdAt) / 60_000))
    .sort((a, b) => a - b);
  const amountBand = (n: number) =>
    n < 2000 ? "〜1,999円" : n < 3000 ? "2,000〜2,999円" : n < 5000 ? "3,000〜4,999円" : "5,000円〜";
  return {
    total: rs.length,
    byStage: tally(rs.map((r) => STAGE_LABEL[deriveStage(r)])),
    byEnd: tally(rs.map((r) => END_LABEL[deriveEnd(r)])),
    byReason: tally(
      rs.flatMap((r) => r.attempts.filter((a) => !a.ok).map((a) => a.reasonJa)),
    ),
    byMethod: tally(rs.map((r) => (r.payMethod ? methodLabel(r.payMethod) : "選ばず"))),
    byDevice: tally(rs.map((r) => r.device?.os)),
    byApp: tally(rs.map((r) => r.device?.app)),
    byReferrer: tally(rs.map((r) => r.referrer)),
    byHour: hours.map((count, hour) => ({ hour, count })),
    byAmount: tally(rs.map((r) => amountBand(r.amount))),
    cardOnlyCount: rs.filter((r) => r.cardOnly).length,
    withCoupon: rs.filter((r) => r.couponCode).length,
    attemptedCount: rs.filter((r) => r.paymentIntentId).length,
    emailEnteredCount: rs.filter((r) => r.progress.email).length,
    repeatPeople: [...emailCount.entries()]
      .filter(([, c]) => c >= 2)
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count),
    durationMinutes: {
      median: percentile(durations, 0.5),
      p90: percentile(durations, 0.9),
    },
  };
}

export function maskEmail(email: string | null): string {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}
