import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProductById } from "@/lib/products";
import { checkoutLimiter, enforce, getClientIp } from "@/lib/ratelimit";

type CheckoutRequest = {
  lines: { productId: string; size: number; qty: number }[];
};

const ALLOWED_SIZES = new Set([36, 38, 40, 41, 42, 44]);

export async function POST(req: Request) {
  const rl = await enforce(checkoutLimiter(), getClientIp(req));
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "リクエストが多すぎます。しばらく待ってから再度お試しください。",
      },
      { status: 429 },
    );
  }
  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json(
      { error: "カートが空です" },
      { status: 400 },
    );
  }

  const lineItems: {
    quantity: number;
    price_data: {
      currency: "jpy";
      unit_amount: number;
      product_data: { name: string; description?: string; images?: string[] };
    };
  }[] = [];

  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const summaryParts: string[] = [];

  for (const line of body.lines) {
    const product = await getProductById(line.productId);
    if (!product) {
      return NextResponse.json(
        { error: `商品が見つかりません: ${line.productId}` },
        { status: 400 },
      );
    }
    if (!product.inStock) {
      return NextResponse.json(
        { error: `${product.name} は在庫切れです` },
        { status: 400 },
      );
    }
    const size = Number(line.size);
    if (!Number.isFinite(size) || !ALLOWED_SIZES.has(size)) {
      return NextResponse.json(
        { error: `無効なサイズ指定です: ${line.size}` },
        { status: 400 },
      );
    }
    const qty = Math.max(1, Math.min(99, Math.floor(line.qty)));
    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "jpy",
        unit_amount: product.price,
        product_data: {
          name: `${product.name} — ${product.subtitle} ・ ${size}cm`,
          description: `${product.material} / 長さ ${size}cm（アジャスター ±2cm）`,
          images: [`${origin}${product.image}`],
        },
      },
    });
    summaryParts.push(`${line.productId}:${size}`);
  }

  try {
    const stripe = getStripe();
    const summary = summaryParts.join(",").slice(0, 480);
    const customer = await stripe.customers.create();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      payment_method_types: ["card"],
      customer: customer.id,
      customer_update: {
        address: "auto",
        name: "auto",
        shipping: "auto",
      },
      shipping_address_collection: {
        allowed_countries: ["JP"],
      },
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 150, currency: "jpy" },
            display_name: "全国一律送料",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
      ],
      locale: "ja",
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      automatic_tax: { enabled: false },
      metadata: {
        line_summary: summary,
        product_ids: body.lines.map((l) => l.productId).join(",").slice(0, 480),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "決済セッションの作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
