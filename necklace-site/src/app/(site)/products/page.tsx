import type { Metadata } from "next";
import { listAllProductsWithInventory } from "@/lib/products";
import { ProductCard } from "@/components/product/product-card";
import { SizeGuide } from "@/components/product/size-guide";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Shop",
  description: "すべてのネックレス",
};

export default async function ProductsPage() {
  const products = await listAllProductsWithInventory();
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-10 md:py-24">
      <header className="mb-10 max-w-3xl md:mb-14">
        <p
          className="font-crayon-en crayon-fx text-5xl leading-none md:text-7xl"
          style={{ color: "var(--bead-blue)" }}
        >
          The collection
        </p>
        <h1 className="font-crayon-jp crayon-fx mt-7 text-[clamp(2.8rem,7.5vw,5.4rem)] leading-[1.1] tracking-tight">
          <span style={{ color: "var(--bead-brown)" }}>すべての</span>
          <br className="md:hidden" />
          ネックレス
        </h1>
        <p className="font-hand mt-10 max-w-md text-[19px] leading-[1.95] text-foreground">
          すべて一点ずつ手で編んでいます。ビーズの並びや色合いには微妙な
          <span
            className="font-crayon-jp px-0.5"
            style={{ color: "var(--bead-rust)" }}
          >
            個体差
          </span>
          があります。
        </p>
        <p
          className="font-crayon-en crayon-fx-soft mt-6 text-[26px] leading-none md:text-[32px]"
          style={{ color: "var(--bead-olive)" }}
        >
          ¥2,500 each ・ 送料 一律 ¥150
        </p>
      </header>

      <div className="mb-16 max-w-2xl md:mb-24">
        <SizeGuide variant="banner" />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-16 md:grid-cols-3 md:gap-x-8 md:gap-y-20 lg:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
    </div>
  );
}
