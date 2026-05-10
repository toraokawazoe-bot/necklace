import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { isEventProcessed } from "@/lib/idempotency";
import {
  sendOrderConfirmationToCustomer,
  sendOrderNotificationToOwner,
  sendPaymentIssueToCustomer,
  sendPaymentIssueToOwner,
  type OrderEmailData,
  type OrderItem,
} from "@/lib/email";

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

  if (await isEventProcessed(event.id)) {
    console.log(`[webhook] ${event.id} (${event.type}) already processed — skipped`);
    return NextResponse.json({ received: true, deduplicated: true });
  }

  try {
    await dispatch(event);
  } catch (e) {
    console.error(
      `[webhook] handler for ${event.type} (${event.id}) failed; acknowledging anyway:`,
      e,
    );
  }

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
    amountTotal: li.amount_total ?? 0,
  }));

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

  const paymentMethod = (() => {
    const types = session.payment_method_types ?? [];
    if (types.includes("customer_balance")) return "銀行振込";
    if (types.includes("konbini")) return "コンビニ払い";
    if (types.includes("card")) return "クレジットカード";
    return types.join(" / ");
  })();

  const data: OrderEmailData = {
    email: customerEmail,
    sessionId: session.id,
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? "jpy",
    items,
    customerName,
    shipping,
    paymentMethodSummary: paymentMethod,
  };

  const tasks: Promise<unknown>[] = [];
  if (customerEmail) {
    tasks.push(sendOrderConfirmationToCustomer(data));
  }
  tasks.push(sendOrderNotificationToOwner(data));
  await Promise.allSettled(tasks);
}

async function handleFailure(
  session: Stripe.Checkout.Session,
  reason: "failed" | "expired",
) {
  const customerEmail =
    session.customer_details?.email ?? session.customer_email ?? null;

  const tasks: Promise<unknown>[] = [];
  if (customerEmail) {
    tasks.push(sendPaymentIssueToCustomer(customerEmail, reason, session.id));
  }
  tasks.push(sendPaymentIssueToOwner(reason, session.id, customerEmail));
  await Promise.allSettled(tasks);
}
