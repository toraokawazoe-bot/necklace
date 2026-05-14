import { NextResponse } from "next/server";
import Stripe from "stripe";
import { recordOrder, type StoredOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETUP_TOKEN = "setup_8f3kl29sdfk0fjlfd";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== SETUP_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const dryRun = url.searchParams.get("dry") === "1";

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    typescript: true,
  });

  const sessions = await stripe.checkout.sessions.list({ limit: 50 });
  const candidates = sessions.data.filter(
    (s) => s.payment_status === "paid" && s.status === "complete",
  );

  const results: Array<{
    sessionId: string;
    email: string | null;
    amount: number;
    recorded: boolean;
  }> = [];

  for (const session of candidates) {
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
      status: "paid",
      createdAt: (session.created ?? Math.floor(Date.now() / 1000)) * 1000,
      amountTotal: session.amount_total ?? 0,
      currency: session.currency ?? "jpy",
      email: customerEmail,
      customerName: session.customer_details?.name ?? null,
      items,
      paymentMethod,
      shippingSummary,
    };

    if (!dryRun) {
      await recordOrder(stored);
    }
    results.push({
      sessionId: session.id,
      email: customerEmail,
      amount: session.amount_total ?? 0,
      recorded: !dryRun,
    });
  }

  return NextResponse.json({
    dryRun,
    totalFound: candidates.length,
    results,
  });
}
