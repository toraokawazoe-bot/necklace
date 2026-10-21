import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getProductById, isAvailable } from "@/lib/products";
import {
  isValidSize,
  sizeDescription,
  sizeNameSuffix,
} from "@/lib/product-category";
import { checkoutLimiter, enforce, getClientIp } from "@/lib/ratelimit";

type CheckoutRequest = {
  lines: { productId: string; size: number; qty: number }[];
};

// 長さの検証ルールはカテゴリごとに lib/product-category.ts にある
// (ネックレス 33〜50cm / ブレスレット 16〜19cm / メガネチェーンは長さなし)。
// Stripe の metadata は 1 キー 500 文字・50 キーまで。在庫用に 1 行 1 キー使う。
const MAX_LINES = 40;

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
  // 在庫チェック・減算用: 商品ごとの合計数量
  const qtyByProduct = new Map<string, number>();
  const stockMeta: Record<string, string> = {};

  if (body.lines.length > MAX_LINES) {
    return NextResponse.json(
      { error: "カートの商品が多すぎます。分けてご注文ください。" },
      { status: 400 },
    );
  }

  for (const line of body.lines) {
    if (!line || typeof line.productId !== "string") {
      return NextResponse.json({ error: "カートの内容が不正です" }, { status: 400 });
    }
    const product = await getProductById(line.productId);
    if (!product || product.published === false) {
      return NextResponse.json(
        { error: "ご注文できない商品がカートに含まれています。カートを確認してください。" },
        { status: 400 },
      );
    }
    if (!isAvailable(product)) {
      return NextResponse.json(
        { error: `${product.name} は在庫切れです` },
        { status: 400 },
      );
    }
    const size = Number(line.size);
    if (!isValidSize(product.category, size)) {
      return NextResponse.json(
        {
          error: `${product.name} の長さが正しくありません。長さを選び直してください。`,
        },
        { status: 400 },
      );
    }
    const rawQty = Number(line.qty);
    if (!Number.isFinite(rawQty) || rawQty < 1) {
      return NextResponse.json(
        { error: "数量が正しくありません" },
        { status: 400 },
      );
    }
    const qty = Math.min(99, Math.floor(rawQty));
    const totalQty = (qtyByProduct.get(product.id) ?? 0) + qty;
    qtyByProduct.set(product.id, totalQty);
    if (product.stock != null && totalQty > product.stock) {
      return NextResponse.json(
        {
          error:
            product.stock <= 0
              ? `${product.name} は在庫切れです`
              : `${product.name} の在庫は残り ${product.stock} 点です。数量を減らしてください。`,
        },
        { status: 400 },
      );
    }
    const description = [
      product.material,
      sizeDescription(product.category, size),
    ]
      .filter(Boolean)
      .join(" / ");
    lineItems.push({
      quantity: qty,
      price_data: {
        currency: "jpy",
        unit_amount: product.price,
        product_data: {
          name: `${product.name} — ${product.subtitle}${sizeNameSuffix(product.category, size)}`,
          description: description || undefined,
          images: [
            product.image.startsWith("/") ? `${origin}${product.image}` : product.image,
          ],
        },
      },
    });
    stockMeta[`stock_${lineItems.length - 1}`] = `${product.id}:${qty}`;
    summaryParts.push(`${line.productId}:${size}`);
  }

  const stripe = getStripe();
  const summary = summaryParts.join(",").slice(0, 480);
  const baseParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    // Customer は作らない。氏名・住所・メールは Checkout が集め、Webhook は customer_details から読む。
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
    // 決済画面でクーポン(Promotion Code)を入力できるようにする。
    // 割引は商品代(line_items)だけにかかり、上の shipping_options の送料 150 円は割引されない。
    allow_promotion_codes: true,
    locale: "ja",
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
    automatic_tax: { enabled: false },
    metadata: {
      line_summary: summary,
      product_ids: body.lines.map((l) => l.productId).join(",").slice(0, 480),
      ...stockMeta,
    },
  };

  try {
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        ...baseParams,
        payment_method_types: ["card", "paypay"] as Stripe.Checkout.SessionCreateParams["payment_method_types"],
      });
    } catch (e) {
      // PayPay が本番で未有効だとセッション作成ごと失敗し、カード決済まで巻き込まれる。
      // カードのみで作り直す。失敗理由はサーバーログに残す。
      console.error("[checkout] session create with paypay failed; retrying with card only:", e);
      session = await stripe.checkout.sessions.create({
        ...baseParams,
        payment_method_types: ["card"],
      });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout] session create failed:", err);
    return NextResponse.json(
      {
        error:
          "決済ページの準備に失敗しました。時間をおいてもう一度お試しください。解決しない場合は Instagram (@740nll) の DM までご連絡ください。",
      },
      { status: 500 },
    );
  }
}
