import { Resend } from "resend";
import { formatJPY } from "./utils";
import { COUPON_KINDS, isCouponKind } from "./coupon-kinds";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.RESEND_FROM ?? "740NLL <onboarding@resend.dev>";
const OWNER_EMAIL = process.env.SHOP_OWNER_EMAIL;
const REPLY_TO = process.env.RESEND_REPLY_TO;

export type OrderItem = {
  name: string;
  qty: number;
  amountTotal: number;
};

export type OrderEmailData = {
  email: string;
  sessionId: string;
  amountTotal: number;
  currency: string;
  items: OrderItem[];
  customerName?: string | null;
  shipping?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  paymentMethodSummary?: string;
  // 送料・クーポン(あれば)。items は割引前の商品代、amountTotal は割引後・送料込みの支払い合計。
  shippingAmount?: number;
  couponCode?: string | null;
  couponKind?: string | null;
  discountAmount?: number;
  // ネックレス購入特典(ブレスレット専用 30%オフ・1 回限り)のコード
  rewardCode?: string | null;
};

const SITE_URL = "https://www.740nll.store";

function couponKindText(kind?: string | null): string {
  return kind && isCouponKind(kind) ? `${COUPON_KINDS[kind].label} ` : "";
}

function formatPricePlain(data: OrderEmailData): string {
  const lines: string[] = [];
  if (data.discountAmount && data.discountAmount > 0) {
    lines.push(
      `クーポン　${couponKindText(data.couponKind)}${data.couponCode ?? ""}　−${formatJPY(data.discountAmount)}`,
    );
  }
  if (data.shippingAmount != null) {
    lines.push(`送料　${formatJPY(data.shippingAmount)}`);
  }
  return lines.join("\n");
}

function formatItemsPlain(items: OrderItem[]): string {
  return items
    .map(
      (i) =>
        `・${i.name} × ${i.qty}　${formatJPY(i.amountTotal)}`,
    )
    .join("\n");
}

function formatShippingPlain(s: OrderEmailData["shipping"]): string {
  if (!s) return "（未取得）";
  const parts = [
    s.postal_code ? `〒${s.postal_code}` : null,
    [s.state, s.city].filter(Boolean).join(""),
    s.line1,
    s.line2,
  ].filter(Boolean);
  return parts.join(" ") || "（未取得）";
}

export async function sendOrderConfirmationToCustomer(
  data: OrderEmailData,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping customer confirmation",
    );
    return;
  }

  const text = [
    `${data.customerName ?? "お客様"} 様`,
    ``,
    `この度は 740NLL をご利用いただきありがとうございます。`,
    `下記の内容でご注文を承りました。`,
    ``,
    `── ご注文内容 ──`,
    formatItemsPlain(data.items),
    ...(formatPricePlain(data) ? [formatPricePlain(data)] : []),
    ``,
    `お支払い合計　${formatJPY(data.amountTotal)}`,
    `お届け先　${formatShippingPlain(data.shipping)}`,
    ``,
    `通常 3〜7 営業日以内に発送いたします。`,
    `発送のご連絡は別途お送りします。`,
    ``,
    ...(data.rewardCode
      ? [
          `── ブレスレット専用クーポン ──`,
          `ネックレスをご購入いただいたお礼に、ブレスレットに使えるクーポンをお贈りします。`,
          `コード　${data.rewardCode}`,
          `ブレスレットが30%オフになります（1回限り・期限なし・送料は対象外）。`,
          `ご注文時にカートのクーポン欄へ入力してください。`,
          `${SITE_URL}/products?category=bracelet`,
          ``,
        ]
      : []),
    `ご不明な点がございましたら、このメールにご返信いただくか`,
    `Instagram (@740nll) の DM までお気軽にご連絡ください。`,
    ``,
    `──`,
    `740NLL`,
    `https://www.740nll.store`,
    ``,
    `注文 ID: ${data.sessionId}`,
  ].join("\n");

  try {
    await resend.emails.send({
      from: FROM,
      to: [data.email],
      subject: "【740NLL】ご注文ありがとうございます",
      text,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    });
  } catch (e) {
    console.error("[email] customer confirmation failed:", e);
  }
}

export type FailureReason = "failed" | "expired";

export async function sendPaymentIssueToCustomer(
  email: string,
  reason: FailureReason,
  sessionId: string,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping failure notice");
    return;
  }

  const reasonText =
    reason === "expired"
      ? "決済ページの有効期限内にお支払いが完了しませんでした"
      : "お支払いが正常に完了しませんでした";

  const text = [
    `740NLL からのお知らせです。`,
    ``,
    `${reasonText}ため、ご注文は成立しておりません。`,
    `お手数ですが、再度ご注文いただくか、Instagram (@740nll) の DM までご連絡ください。`,
    ``,
    `──`,
    `740NLL`,
    `https://www.740nll.store`,
    ``,
    `セッション ID: ${sessionId}`,
  ].join("\n");

  try {
    await resend.emails.send({
      from: FROM,
      to: [email],
      subject:
        reason === "expired"
          ? "【740NLL】お支払い手続き期限切れのお知らせ"
          : "【740NLL】お支払い未完了のお知らせ",
      text,
      ...(REPLY_TO ? { replyTo: REPLY_TO } : {}),
    });
  } catch (e) {
    console.error("[email] customer failure notice failed:", e);
  }
}

export async function sendPaymentIssueToOwner(
  reason: FailureReason,
  sessionId: string,
  email?: string | null,
): Promise<void> {
  const resend = getResend();
  if (!resend || !OWNER_EMAIL) return;

  const reasonText =
    reason === "expired" ? "セッション期限切れ" : "決済失敗";

  const text = [
    `Stripe Webhook 通知: ${reasonText}`,
    ``,
    `セッション ID: ${sessionId}`,
    `お客様メール: ${email ?? "（未取得）"}`,
    ``,
    `https://dashboard.stripe.com/payments/${sessionId}`,
  ].join("\n");

  try {
    await resend.emails.send({
      from: FROM,
      to: [OWNER_EMAIL],
      subject: `【740NLL システム】${reasonText}`,
      text,
    });
  } catch (e) {
    console.error("[email] owner failure notice failed:", e);
  }
}

export type ShipmentEmailData = {
  email: string;
  customerName?: string | null;
  sessionId: string;
  items: OrderItem[];
  shipping?: OrderEmailData["shipping"];
  carrierLabel: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
};

export async function sendShipmentNotificationToCustomer(
  data: ShipmentEmailData,
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping shipment notification",
    );
    return;
  }

  const trackingLines = data.trackingNumber
    ? [
        `配送方法　${data.carrierLabel}`,
        `追跡番号　${data.trackingNumber}`,
        data.trackingUrl ? `追跡 URL　${data.trackingUrl}` : null,
      ].filter(Boolean) as string[]
    : [`配送方法　${data.carrierLabel}`, `(追跡番号なしの便のため追跡できません)`];

  const text = [
    `${data.customerName ?? "お客様"} 様`,
    ``,
    `ご注文の商品を本日発送いたしました。`,
    `お受け取りまで今しばらくお待ちください。`,
    ``,
    `── 発送内容 ──`,
    formatItemsPlain(data.items),
    ``,
    ...trackingLines,
    `お届け先　${formatShippingPlain(data.shipping ?? null)}`,
    ``,
    `通常 1〜4 日程度でお手元に届きます(地域により前後します)。`,
    `万が一届かない、商品に不備があるなどございましたら、`,
    `このメールにご返信いただくか Instagram (@740nll) の DM までご連絡ください。`,
    ``,
    `──`,
    `740NLL`,
    `https://www.740nll.store`,
    ``,
    `注文 ID: ${data.sessionId}`,
  ].join("\n");

  try {
    await resend.emails.send({
      from: FROM,
      to: [data.email],
      subject: "【740NLL】発送のお知らせ",
      text,
    });
  } catch (e) {
    console.error("[email] shipment notification failed:", e);
  }
}

export async function sendOrderNotificationToOwner(
  data: OrderEmailData,
): Promise<void> {
  const resend = getResend();
  if (!resend || !OWNER_EMAIL) {
    console.warn(
      "[email] RESEND_API_KEY or SHOP_OWNER_EMAIL not set — skipping owner notification",
    );
    return;
  }

  const text = [
    `新しい注文が入りました。`,
    ``,
    `── 注文内容 ──`,
    formatItemsPlain(data.items),
    ...(formatPricePlain(data) ? [formatPricePlain(data)] : []),
    ``,
    `合計　${formatJPY(data.amountTotal)}`,
    ...(data.rewardCode ? [`特典クーポン発行　${data.rewardCode}（ブレスレット30%）`] : []),
    `決済方法　${data.paymentMethodSummary ?? "（未取得）"}`,
    ``,
    `── お客様情報 ──`,
    `氏名　${data.customerName ?? "（未取得）"}`,
    `メール　${data.email}`,
    `お届け先　${formatShippingPlain(data.shipping)}`,
    ``,
    `── システム情報 ──`,
    `Stripe Session: ${data.sessionId}`,
    `https://dashboard.stripe.com/payments/${data.sessionId}`,
  ].join("\n");

  try {
    await resend.emails.send({
      from: FROM,
      to: [OWNER_EMAIL],
      subject: `【740NLL 受注】${data.items.map((i) => i.name).join(" / ")}`,
      text,
    });
  } catch (e) {
    console.error("[email] owner notification failed:", e);
  }
}

export type OversoldItem = {
  productName: string;
  remaining: number;
};

// 在庫を超えて売れてしまった(同時購入で売り越し)時にオーナーへ知らせる。
export async function sendOversellNotificationToOwner(
  sessionId: string,
  items: OversoldItem[],
): Promise<void> {
  const resend = getResend();
  if (!resend || !OWNER_EMAIL) {
    console.warn(
      "[email] RESEND_API_KEY or SHOP_OWNER_EMAIL not set — skipping oversell notice",
    );
    return;
  }

  const text = [
    `在庫数を超えて注文が入りました(売り越し)。`,
    `対応(お客様へのご連絡・返金・追加制作)をご検討ください。`,
    ``,
    ...items.map((i) => `・${i.productName}　残数 ${i.remaining}（マイナス=足りない個数）`),
    ``,
    `Stripe Session: ${sessionId}`,
    `https://dashboard.stripe.com/payments/${sessionId}`,
  ].join("\n");

  try {
    await resend.emails.send({
      from: FROM,
      to: [OWNER_EMAIL],
      subject: "【740NLL システム】在庫の売り越しが発生しました",
      text,
    });
  } catch (e) {
    console.error("[email] oversell notice failed:", e);
  }
}
