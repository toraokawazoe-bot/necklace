import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { listProducts } from "@/lib/product-store";
import { ProductAdminList } from "@/components/admin/ProductAdminList";
import { SeedButton } from "@/components/admin/SeedButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminProductsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const products = await listProducts({ includeUnpublished: true });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground">
              ← Admin
            </Link>
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-serif tracking-tight">
            商品管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {products.length} 件 ・ ドラッグまたは矢印で並び替え
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm text-background transition hover:opacity-90"
        >
          + 新規追加
        </Link>
      </header>

      {products.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-8">
          <ProductAdminList products={products} />
        </div>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-xl border border-border bg-muted/30 p-8 text-center">
      <p className="text-base font-medium">まだ商品が登録されていません</p>
      <p className="mt-2 text-sm text-muted-foreground">
        「シードを実行」で既存の10商品を一括取り込みするか、新規追加できます。
      </p>
      <SeedButton />
    </div>
  );
}

