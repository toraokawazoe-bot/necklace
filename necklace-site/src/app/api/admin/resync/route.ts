import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";
import { recordOrder, type StoredOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETUP_TOKEN = "setup_8f3kl29sdfk0fjlfd";
const NS = "740nll:orders";

function getRedis(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "",
    token:
      process.env.KV_REST_API_TOKEN ??
      process.env.UPSTASH_REDIS_REST_TOKEN ??
      "",
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== SETUP_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    typescript: true,
  });
  const redis = getRedis();

  const wipeKeys: string[] = [
    `${NS}:recent`,
    `${NS}:count:paid:total`,
    `${NS}:count:failed:total`,
    `${NS}:count:expired:total`,
    `${NS}:count:refunded:total`,
    `${NS}:revenue:total`,
  ];
  for (const k of wipeKeys) {
    await redis.del(k);
  }
  const dayKeys = await redis.keys(`${NS}:*:day:*`);
  for (const k of dayKeys) {
    await redis.del(k);
  }

  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const paid = sessions.data.filter(
    (s) => s.payment_status === "paid" && s.status === "complete",
  );

  const summary: Array<{
    sessionId: string;
    status: StoredOrder["status"];
    amount: number;
    refundCount: number;
  }> = [];

  paid.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));

  for (const session of paid) {
    const piId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    let refundCount = 0;
    if (piId) {
      const refunds = await stripe.refunds.list({
        payment_intent: piId,
        limit: 10,
      });
      refundCount = refunds.data.filter((r) => r.status === "succeeded").length;
    }
    const status: StoredOrder["status"] = refundCount > 0 ? "refunded" : "paid";

    const itemsResp = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
    });
    const items = itemsResp.data.map((li) => ({
      name: li.description ?? "(無題)",
      qty: li.quantity ?? 1,
      amountTotal: li.amount_total ?? 0,
    }));

    const types = session.payment_method_types ?? [];
    const paymentMethod = types.includes("customer_balance")
      ? "銀行振込"
      : types.includes("konbini")
        ? "コンビニ払い"
        : types.includes("card")
          ? "クレジットカード"
          : types.join(" / ");

    const customerEmail =
      session.customer_details?.email ?? session.customer_email ?? null;

    const shipping = (
      session as unknown as {
        collected_information?: {
          shipping_details?: {
            address?: {
              line1?: string;
              line2?: string | null;
              city?: string;
              state?: string;
              postal_code?: string;
              country?: string;
            };
          };
        };
      }
    ).collected_information?.shipping_details?.address;
    const shippingSummary = shipping
      ? [
          shipping.postal_code ? `〒${shipping.postal_code}` : null,
          [shipping.state, shipping.city].filter(Boolean).join(""),
          shipping.line1,
          shipping.line2,
        ]
          .filter(Boolean)
          .join(" ") || null
      : null;

    const stored: StoredOrder = {
      sessionId: session.id,
      status,
      createdAt: (session.created ?? Math.floor(Date.now() / 1000)) * 1000,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? "jpy",
      email: customerEmail,
      customerName: session.customer_details?.name ?? null,
      items,
      paymentMethod,
      shippingSummary,
    };

    await recordOrder(stored);
    summary.push({
      sessionId: session.id,
      status,
      amount: session.amount_total ?? 0,
      refundCount,
    });
  }

  return NextResponse.json({
    wiped: true,
    totalSessions: summary.length,
    paidCount: summary.filter((s) => s.status === "paid").length,
    refundedCount: summary.filter((s) => s.status === "refunded").length,
    summary,
  });
}
