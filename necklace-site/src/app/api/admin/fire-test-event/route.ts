import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETUP_TOKEN = "setup_8f3kl29sdfk0fjlfd";
const WEBHOOK_URL = "https://necklace-site.vercel.app/api/webhooks/stripe";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== SETUP_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not set" },
      { status: 500 },
    );
  }

  const stripeReal = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    typescript: true,
  });
  const realSession = await stripeReal.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: 50,
          product_data: {
            name: "テスト商品 (synthetic end-to-end)",
          },
        },
      },
    ],
    payment_method_types: ["card"],
    success_url: "https://necklace-site.vercel.app/checkout/success",
    cancel_url: "https://necklace-site.vercel.app/checkout/cancel",
    customer_email: "synthetic-webhook-test@example.com",
  });
  const sessionId = realSession.id;
  const eventPayload = {
    id: `evt_test_synthetic_${Date.now()}`,
    object: "event",
    api_version: "2024-12-18.acacia",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: "paid",
        status: "complete",
        amount_total: 200,
        currency: "jpy",
        payment_method_types: ["card"],
        customer_email: "synthetic-webhook-test@example.com",
        customer_details: {
          email: "synthetic-webhook-test@example.com",
          name: "Synthetic Test",
          phone: null,
          tax_exempt: "none",
          tax_ids: [],
        },
        collected_information: {
          shipping_details: {
            name: "Synthetic Test",
            address: {
              line1: "Webhook lane 1",
              line2: null,
              city: "Tokyo",
              state: "Tokyo",
              postal_code: "1000000",
              country: "JP",
            },
          },
        },
        metadata: { synthetic: "true" },
      },
    },
  };

  const payload = JSON.stringify(eventPayload);
  const stripe = new Stripe("sk_test_dummy_for_signing", { typescript: true });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": header,
    },
    body: payload,
  });

  const text = await res.text();
  return NextResponse.json({
    sentTo: WEBHOOK_URL,
    webhookStatus: res.status,
    webhookBody: text,
    sentSessionId: sessionId,
  });
}
