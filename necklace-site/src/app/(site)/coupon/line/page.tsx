import type { Metadata } from "next";
import { LineCouponClaim } from "./claim";
import { NECKLACE10_PERCENT } from "@/lib/coupon-kinds";

export const metadata: Metadata = {
  title: "LINEクーポン",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LineCouponPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string | string[] }>;
}) {
  const { uid } = await searchParams;
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        LINE coupon
      </p>
      <h1 className="font-hand mt-6 text-4xl md:text-5xl">
        ネックレスが<br />{NECKLACE10_PERCENT}%オフ。
      </h1>
      <LineCouponClaim uid={typeof uid === "string" ? uid : null} />
    </div>
  );
}
