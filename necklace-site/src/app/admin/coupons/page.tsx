import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { listCoupons, DEFAULT_PERCENT_OFF, type CouponView } from "@/lib/coupons";
import { CouponManager } from "@/components/admin/CouponManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCouponsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  let coupons: CouponView[] = [];
  let loadError: string | null = null;
  if (!process.env.STRIPE_SECRET_KEY) {
    loadError = "STRIPE_SECRET_KEY が未設定です。";
  } else {
    try {
      coupons = await listCoupons();
    } catch (e) {
      console.error("[admin/coupons] list failed:", e);
      loadError = "Stripe から一覧を取得できませんでした。時間をおいて開き直してください。";
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
          <Link href="/admin" className="inline-flex min-h-11 items-center hover:text-foreground">
            ← Admin
          </Link>
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-serif tracking-tight">
          クーポン
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          {DEFAULT_PERCENT_OFF}%オフ ・ 1回だけ使える ・ 送料は割引されません
        </p>
      </header>

      <CouponManager initial={coupons} loadError={loadError} />
    </main>
  );
}
