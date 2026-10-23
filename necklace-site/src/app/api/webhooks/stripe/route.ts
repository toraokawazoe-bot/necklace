import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { claimEvent, claimOnce, completeEvent, releaseEvent } from "@/lib/idempotency";
import { getProductById } from "@/lib/products";
import { decrementStockForOrder } from "@/lib/inventory";
import {
  sendOrderConfirmationToCustomer,
  sendOrderNotificationToOwner,
  sendOversellNotificationToOwner,
  sendPaymentIssueToCustomer,
  sendPaymentIssueToOwner,
  type OrderEmailData,
  type OrderItem,
} from "@/lib/email";
import {
  issueBraceletReward,
  markCouponUsed,
  releaseCoupon,
  resolveSessionDiscount,
} from "@/lib/coupons";
import { markOrderRefunded, recordOrder, type StoredOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json(
      { error: "stripe-signature or STRIPE_WEBHOOK_SECRET missing" },
      { status: 400 },
    );
  }

  const body = await req.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 },
    );
  }

  // 処理済みの印は「成功した後」にだけ付ける。処理中は短いロック、失敗したらロックを外して
  // 500 を返し、Stripe に再送させる(以前は失敗しても 200 を返して注文が消えていた)。
  const claim = await claimEvent(event.id);
  if (claim === "done") {
    console.log(`[webhook] ${event.id} (${event.type}) already processed — skipped`);
    return NextResponse.json({ received: true, deduplicated: true });
  }
  if (claim === "in_progress") {
    console.warn(`[webhook] ${event.id} (${event.type}) is being processed elsewhere — asking Stripe to retry`);
    return NextResponse.json({ error: "processing" }, { status: 409 });
  }

  try {
    await dispatch(event);
  } catch (e) {
    console.error(
      `[webhook] handler for ${event.type} (${event.id}) failed; asking Stripe to retry:`,
      e,
    );
    await releaseEvent(event.id);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  await completeEvent(event.id);
  return NextResponse.json({ received: true });
}

async function dispatch(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        await handlePaid(session);
      } else {
        console.log(
          `[webhook] ${event.type} received with payment_status=${session.payment_status}; awaiting async confirmation`,
        );
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleFailure(session, "failed");
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleFailure(session, "expired");
      break;
    }
    case "charge.refunded": {
      await handleRefund(event.data.object as Stripe.Charge);
      break;
    }
    default:
      console.log(`[webhook] ignoring unhandled event type: ${event.type}`);
  }
}

async function handlePaid(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const lineItemsResp = await stripe.checkout.sessions.listLineItems(
    session.id,
    { limit: 100 },
  );

  const items: OrderItem[] = lineItemsResp.data.map((li) => ({
    name: li.description ?? "(無題)",
    qty: li.quantity ?? 1,
    // 割引前の商品代。クーポン・送料は別行(下の discount / shippingAmount)で扱い、
    // 「商品代 − クーポン + 送料 = 支払い合計」になるようにする。
    amountTotal: li.amount_subtotal ?? li.amount_total ?? 0,
  }));
  const discount = await resolveSessionDiscount(session);
  // 使われたクーポンを使用済みにする(再送されても結果は同じ)
  const usedCode = session.metadata?.coupon_code;
  if (usedCode) await markCouponUsed(usedCode, session.id);
  // ネックレスを含む注文には、ブレスレット専用 30%オフを 1 枚(注文 ID で冪等)。
  // 購入完了画面も同じ関数を呼ぶので、どちらが先でも同じコードになる。
  const reward =
    session.metadata?.has_necklace === "1"
      ? await issueBraceletReward(session.id)
      : null;
  const shippingAmount = session.total_details?.amount_shipping ?? 0;

  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? "";
  const customerName = session.customer_details?.name ?? null;
  const shipping = session.collected_information?.shipping_details?.address
    ? {
        line1: session.collected_information.shipping_details.address.line1,
        line2: session.collected_information.shipping_details.address.line2,
        city: session.collected_information.shipping_details.address.city,
        state: session.collected_information.shipping_details.address.state,
        postal_code:
          session.collected_information.shipping_details.address.postal_code,
        country: session.collected_information.shipping_details.address.country,
      }
    : null;

  const paymentMethod = await resolvePaymentMethod(session);

  const data: OrderEmailData = {
    email: customerEmail,
    sessionId: session.id,
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? "jpy",
    items,
    customerName,
    shipping,
    paymentMethodSummary: paymentMethod,
    shippingAmount,
    couponCode: discount?.code ?? null,
    discountAmount: discount?.amount ?? 0,
    couponKind: discount?.kind ?? null,
    rewardCode: reward?.code ?? null,
  };

  const shippingSummary = (() => {
    if (!shipping) return null;
    const parts = [
      shipping.postal_code ? `〒${shipping.postal_code}` : null,
      [shipping.state, shipping.city].filter(Boolean).join(""),
      shipping.line1,
      shipping.line2,
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  })();

  const stored: StoredOrder = {
    sessionId: session.id,
    status: "paid",
    createdAt: Date.now(),
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? "jpy",
    email: customerEmail || null,
    customerName,
    items,
    paymentMethod,
    shippingSummary,
    ...(discount
      ? {
          discountAmount: discount.amount,
          ...(discount.code ? { couponCode: discount.code } : {}),
          ...(discount.kind ? { couponKind: discount.kind } : {}),
        }
      : {}),
    ...(reward ? { rewardCode: reward.code } : {}),
  };

  // 各ステップは注文(session.id)単位で冪等。途中で失敗して Stripe が再送しても、
  // 注文の二重登録・在庫の二重減算・メールの二重送信は起きない。
  await recordOrder(stored);
  await applyStock(session);

  if (await claimOnce(`paid-mail:${session.id}`)) {
    const tasks: Promise<unknown>[] = [];
    if (customerEmail) {
      tasks.push(sendOrderConfirmationToCustomer(data));
    }
    tasks.push(sendOrderNotificationToOwner(data));
    await Promise.allSettled(tasks);
  }
}

// 支払い確定時に在庫カウンタを原子的に減らす。在庫数を設定していない商品は何もしない。
async function applyStock(session: Stripe.Checkout.Session) {
  const lines: { productId: string; qty: number }[] = [];
  for (const [key, value] of Object.entries(session.metadata ?? {})) {
    if (!/^stock_\d+$/.test(key)) continue;
    const [productId, qtyRaw] = value.split(":");
    const qty = Number(qtyRaw);
    if (productId && Number.isInteger(qty) && qty > 0) {
      lines.push({ productId, qty });
    }
  }
  if (lines.length === 0) return;

  const result = await decrementStockForOrder(session.id, lines);
  if (result.soldOut.length > 0) {
    console.log(`[webhook] sold out after ${session.id}: ${result.soldOut.join(",")}`);
  }
  if (result.oversold.length > 0) {
    const items = await Promise.all(
      result.oversold.map(async (o) => ({
        productName: (await getProductById(o.productId))?.name ?? o.productId,
        remaining: o.remaining,
      })),
    );
    console.error(`[webhook] OVERSOLD in ${session.id}:`, items);
    await sendOversellNotificationToOwner(session.id, items);
  }
}

// 実際に使われた支払い方法を PaymentIntent から取る(session.payment_method_types は
// 「選べた方法」の一覧で、実際に何で払ったかではない)。取れなければ「不明」。
async function resolvePaymentMethod(
  session: Stripe.Checkout.Session,
): Promise<string> {
  const pi = session.payment_intent;
  const intentId = typeof pi === "string" ? pi : pi?.id;
  if (!intentId) return "不明";
  try {
    const intent = await getStripe().paymentIntents.retrieve(intentId, {
      expand: ["payment_method"],
    });
    const pm = intent.payment_method;
    const type: string | undefined =
      pm && typeof pm === "object" ? pm.type : undefined;
    switch (type) {
      case "card":
        return "クレジットカード";
      case "paypay":
        return "PayPay";
      case "konbini":
        return "コンビニ払い";
      case "customer_balance":
        return "銀行振込";
      case undefined:
        return "不明";
      default:
        return type;
    }
  } catch (e) {
    console.error(`[webhook] payment method lookup failed for ${session.id}:`, e);
    return "不明";
  }
}

// 全額返金された決済の注文を refunded にする。一部返金は注文の状態を変えない。
async function handleRefund(charge: Stripe.Charge) {
  if (!charge.refunded) {
    console.log(`[webhook] partial refund on ${charge.id}; order status unchanged`);
    return;
  }
  const pi = charge.payment_intent;
  const intentId = typeof pi === "string" ? pi : pi?.id;
  if (!intentId) return;
  const sessions = await getStripe().checkout.sessions.list({
    payment_intent: intentId,
    limit: 1,
  });
  const sessionId = sessions.data[0]?.id;
  if (!sessionId) {
    console.warn(`[webhook] refund for ${charge.id}: no checkout session found`);
    return;
  }
  const updated = await markOrderRefunded(sessionId);
  console.log(`[webhook] refund for ${sessionId}: ${updated ? "marked refunded" : "no matching paid order"}`);
}

async function handleFailure(
  session: Stripe.Checkout.Session,
  reason: "failed" | "expired",
) {
  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? null;

  const stored: StoredOrder = {
    sessionId: session.id,
    status: reason,
    createdAt: Date.now(),
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? "jpy",
    email: customerEmail,
    customerName: session.customer_details?.name ?? null,
    items: [],
    paymentMethod: null,
    shippingSummary: null,
  };

  await recordOrder(stored);

  // 失敗・期限切れ: 予約していたクーポンを未使用に戻す
  const code = session.metadata?.coupon_code;
  const token = session.metadata?.coupon_token;
  if (code && token) await releaseCoupon(code, token);

  if (await claimOnce(`${reason}-mail:${session.id}`)) {
    const tasks: Promise<unknown>[] = [];
    // 期限切れ(カート放棄)のお客様には送らない。購入の意思を撤回した人に「ご注文は成立していません」が届くため。
    if (customerEmail && reason === "failed") {
      tasks.push(sendPaymentIssueToCustomer(customerEmail, reason, session.id));
    }
    tasks.push(sendPaymentIssueToOwner(reason, session.id, customerEmail));
    await Promise.allSettled(tasks);
  }
}
