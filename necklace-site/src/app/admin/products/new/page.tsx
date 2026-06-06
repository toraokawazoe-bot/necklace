import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <Link href="/admin/products" className="hover:text-foreground">
            ← 商品管理
          </Link>
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-serif tracking-tight">
          新規商品の追加
        </h1>
      </header>
      <ProductForm />
    </main>
  );
}
