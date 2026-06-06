import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { getProduct } from "@/lib/product-store";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
          <Link href="/admin/products" className="hover:text-foreground">
            ← 商品管理
          </Link>
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-serif tracking-tight">
          {product.name} を編集
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">ID: {product.id}</p>
      </header>
      <ProductForm product={product} />
    </main>
  );
}
