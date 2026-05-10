import Link from "next/link";
import { getStripe } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { ClearCartOnMount } from "./clear-cart";

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
  if (session_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(session_id);
      customerEmail = session.customer_details?.email ?? null;
      amountTotal = session.amount_total ?? null;
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
        ありがとうございました。
      </h1>
      <p className="font-hand mt-8 max-w-md text-[16px] leading-[1.85] text-muted-foreground">
        ご注文を承りました。
        {customerEmail ? `${customerEmail} 宛に確認メールをお送りしました。` : "確認メールをお送りしました。"}
      </p>
      {amountTotal !== null && (
        <p className="mt-4 text-[13px] tabular-nums text-muted-foreground">
          合計 ¥{amountTotal.toLocaleString("ja-JP")}
        </p>
      )}
      <div className="mt-10 flex gap-3">
        <Link href="/products">
          <Button variant="outline">買い物を続ける</Button>
        </Link>
      </div>
    </div>
  );
}
