import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { listCoupons, type CouponView } from "@/lib/coupons";
import { GENERAL30_PERCENT } from "@/lib/coupon-kinds";
import { CouponManager } from "@/components/admin/CouponManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCouponsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  let coupons: CouponView[] = [];
  let loadError: string | null = null;
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    loadError = "Redis（Upstash）が未設定です。";
  } else {
    try {
      coupons = await listCoupons();
    } catch (e) {
      console.error("[admin/coupons] list failed:", e);
      loadError = "一覧を取得できませんでした。時間をおいて開き直してください。";
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
          この画面で発行するのは全商品{GENERAL30_PERCENT}%オフ ・ 1回だけ使える ・ 送料は割引されません。LINE（ネックレス10%）とネックレス購入特典（ブレスレット30%）は自動で発行され、下の一覧に並びます
        </p>
      </header>

      <CouponManager initial={coupons} loadError={loadError} />
    </main>
  );
}
