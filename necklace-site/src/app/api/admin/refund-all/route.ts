import { NextResponse } from "next/server";
import Stripe from "stripe";

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

  const sessions = await stripe.checkout.sessions.list({ limit: 100 });
  const candidates = sessions.data.filter(
    (s) => s.payment_status === "paid" && s.payment_intent,
  );

  const results: Array<{
    sessionId: string;
    paymentIntent: string;
    amount: number;
    status: string;
    refundId?: string;
    error?: string;
  }> = [];

  for (const session of candidates) {
    const piId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!piId) continue;

    const entry: (typeof results)[number] = {
      sessionId: session.id,
      paymentIntent: piId,
      amount: session.amount_total ?? 0,
      status: "pending",
    };

    if (dryRun) {
      entry.status = "would-refund";
      results.push(entry);
      continue;
    }

    try {
      const refund = await stripe.refunds.create({ payment_intent: piId });
      entry.refundId = refund.id;
      entry.status = refund.status ?? "created";
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      entry.status = "failed";
      entry.error = message;
    }
    results.push(entry);
  }

  return NextResponse.json({
    dryRun,
    totalProcessed: results.length,
    results,
  });
}
