import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETUP_TOKEN = "setup_8f3kl29sdfk0fjlfd";
const WEBHOOK_URL = "https://necklace-site.vercel.app/api/webhooks/stripe";
const EVENTS: string[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== SETUP_TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const stripe = getStripe();
  const action = url.searchParams.get("action") ?? "ensure";

  try {
    if (action === "list") {
      const list = await stripe.webhookEndpoints.list({ limit: 50 });
      return NextResponse.json({
        keyMode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
          ? "live"
          : "test",
        endpoints: list.data.map((w) => ({
          id: w.id,
          url: w.url,
          status: w.status,
          enabled_events: w.enabled_events,
        })),
      });
    }

    const existing = await stripe.webhookEndpoints.list({ limit: 50 });
    for (const w of existing.data) {
      if (w.url === WEBHOOK_URL) {
        await stripe.webhookEndpoints.del(w.id);
      }
    }

    const created = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: EVENTS as never,
    });

    return NextResponse.json({
      keyMode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
        ? "live"
        : "test",
      id: created.id,
      url: created.url,
      status: created.status,
      secret: created.secret,
      enabled_events: created.enabled_events,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
