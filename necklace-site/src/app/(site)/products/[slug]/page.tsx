import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllSlugs,
  getProductBySlugWithInventory,
  listAllProductsWithInventory,
} from "@/lib/products";
import { ProductBuy } from "@/components/product/product-buy";
import { ProductCard } from "@/components/product/product-card";
import { formatJPY } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlugWithInventory(slug);
  if (!product) return {};
  return {
    title: `${product.name} — ${product.subtitle}`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlugWithInventory(slug);
  if (!product) notFound();

  const all = await listAllProductsWithInventory();
  const related = all
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-12 md:px-10">
      <nav className="font-hand mb-10 flex items-center gap-2 text-[15px] text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          Shop
        </Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-12 md:grid-cols-2 md:gap-16">
        <div className="space-y-4">
          <div
            className="relative aspect-[3/4] w-full overflow-hidden"
            style={{ backgroundColor: product.imageBg }}
          >
            <span
              className="absolute -right-3 top-4 z-10 block h-[18px] w-[64px] rotate-[12deg]"
              style={{
                background: "rgba(239,217,176,0.78)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            />
            <span
              className="absolute -left-3 bottom-4 z-10 block h-[18px] w-[64px] -rotate-[10deg]"
              style={{
                background: "rgba(239,217,176,0.78)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            />
            <Image
              src={product.image}
              alt={product.imageAlt}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              style={{
                filter:
                  "sepia(0.1) saturate(0.9) brightness(1.02) contrast(0.96)",
              }}
              priority
            />
          </div>
          {product.gallery && product.gallery.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {product.gallery.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-square overflow-hidden"
                  style={{ backgroundColor: product.imageBg }}
                >
                  <Image
                    src={url}
                    alt={`${product.imageAlt} ${i + 2}`}
                    fill
                    sizes="(min-width: 768px) 16vw, 33vw"
                    className="object-cover"
                    style={{
                      filter:
                        "sepia(0.1) saturate(0.9) brightness(1.02) contrast(0.96)",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-start md:sticky md:top-24 md:self-start">
          <p
            className="font-marker text-3xl leading-none md:text-5xl"
            style={{ color: "var(--bead-blue)" }}
          >
            {product.subtitle}
          </p>
          <h1 className="font-hand mt-5 text-[clamp(2.4rem,5.5vw,4.4rem)] font-semibold leading-[1.05] tracking-tight">
            {product.name}
          </h1>
          <p
            className="font-marker mt-6 text-[34px] leading-none tabular-nums md:text-[40px]"
            style={{ color: "var(--bead-rust)" }}
          >
            {formatJPY(product.price)}
          </p>

          <p className="font-hand mt-10 max-w-md text-[17px] leading-[1.95] text-foreground/85">
            {product.description}
          </p>

          <dl className="font-hand mt-10 space-y-4 border-t border-border pt-7 text-[16px]">
            <div className="flex justify-between gap-4">
              <dt
                className="font-marker text-[18px]"
                style={{ color: "var(--bead-olive)" }}
              >
                素材
              </dt>
              <dd className="text-right text-foreground/85">{product.material}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt
                className="font-marker text-[18px]"
                style={{ color: "var(--bead-olive)" }}
              >
                長さ
              </dt>
              <dd className="text-right text-foreground/85">{product.length}</dd>
            </div>
          </dl>

          <ul className="font-hand mt-7 space-y-2 text-[15px] text-muted-foreground">
            {product.details.map((d) => (
              <li key={d} className="flex gap-2">
                <span style={{ color: "var(--bead-brown)" }} aria-hidden>—</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>

          <div className="mt-12">
            <ProductBuy productId={product.id} disabled={!product.inStock} />
            <p className="font-hand mt-4 text-[14px] text-muted-foreground">
              送料 全国一律 ¥150
            </p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-32 border-t border-border pt-16">
          <p
            className="font-marker text-4xl leading-none md:text-6xl"
            style={{ color: "var(--bead-olive)" }}
          >
            You may also like
          </p>
          <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-16 md:grid-cols-3 md:gap-x-8">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
