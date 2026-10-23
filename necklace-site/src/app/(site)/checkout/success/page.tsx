import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { ClearCartOnMount } from "./clear-cart";
import { CouponCode } from "@/components/coupon/coupon-code";
import { issueBraceletReward } from "@/lib/coupons";
import { BRACELET30_PERCENT } from "@/lib/coupon-kinds";

type SearchParams = Promise<{ session_id?: string }>;

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session_id } = await searchParams;

  let customerEmail: string | null = null;
  let amountTotal: number | null = null;
  let discount = 0;
  let rewardCode: string | null = null;
  if (session_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id);
      customerEmail = session.customer_details?.email ?? null;
      amountTotal = session.amount_total ?? null;
      discount = session.total_details?.amount_discount ?? 0;
      // ネックレスを含む支払い済みの注文には、ブレスレット専用クーポンを出す。
      // Webhook も同じ関数(注文 ID で冪等)を呼ぶので、どちらが先でも同じコードになる。
      if (
        session.payment_status === "paid" &&
        session.metadata?.has_necklace === "1"
      ) {
        try {
          rewardCode = (await issueBraceletReward(session.id)).code;
        } catch (e) {
          console.error("[success] reward issue failed:", e);
        }
      }
    } catch {
      // surface a generic confirmation even if retrieval fails
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <ClearCartOnMount />
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        Order confirmed
      </p>
      <h1 className="font-hand mt-6 text-4xl md:text-5xl">
        ご注文ありがとうございます。
      </h1>
      <p className="font-hand mt-8 max-w-md text-[16px] leading-[1.85] text-muted-foreground">
        {customerEmail ? `ご注文内容を記載したメールを ${customerEmail} 宛にお送りしました。` : "ご注文内容を記載したメールをお送りしました。"}
        <br />
        発送は、ご注文・ご入金の確認後、通常3〜7営業日以内です。
      </p>
      {amountTotal !== null && (
        <p className="mt-4 text-[13px] tabular-nums text-muted-foreground">
          {discount > 0 ? `クーポン −¥${discount.toLocaleString("ja-JP")} ・ ` : ""}
          合計 ¥{amountTotal.toLocaleString("ja-JP")}
        </p>
      )}
      {rewardCode && (
        <section
          aria-labelledby="reward-title"
          className="mt-12 flex w-full max-w-sm flex-col items-center border-t border-border pt-10"
        >
          <h2 id="reward-title" className="font-hand text-2xl">
            ブレスレット専用クーポン
          </h2>
          <p className="font-hand mt-4 text-[16px] leading-[1.85] text-muted-foreground">
            ネックレスをお選びいただいたお礼です。ブレスレットが{BRACELET30_PERCENT}%オフになります（1回限り・期限なし・送料は対象外）。
            同じコードを確認メールにもお送りしています。
          </p>
          <div className="mt-6 w-full">
            <CouponCode code={rewardCode} />
          </div>
          <Link
            href="/products?category=bracelet"
            className="mt-2 inline-flex min-h-11 items-center text-[16px] underline underline-offset-4"
          >
            ブレスレットを見る
          </Link>
        </section>
      )}
      <div className="mt-10 flex gap-3">
        <Link href="/products">
          <Button variant="outline">お買い物を続ける</Button>
        </Link>
      </div>
    </div>
  );
}
