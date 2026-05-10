import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { formatJPY } from "@/lib/utils";

const ACCENT_COLORS = [
  "var(--bead-blue)",
  "var(--bead-rust)",
  "var(--bead-olive)",
  "var(--bead-brown)",
];

const TAPE_COLOR = "rgba(239,217,176,0.78)";
const PHOTO_FILTER = "sepia(0.1) saturate(0.9) brightness(1.02) contrast(0.96)";

export function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const number = String(index + 1).padStart(2, "0");

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div
        className="relative aspect-[3/4] w-full overflow-hidden"
        style={{ backgroundColor: product.imageBg }}
      >
        <span
          className="font-crayon-en absolute left-3 top-3 z-20 text-2xl leading-[0.95] md:text-3xl"
          style={{
            color: accent,
            textShadow:
              "0 0 6px rgba(255,255,255,0.6), 0 1px 0 rgba(255,255,255,0.45)",
          }}
        >
          No.{number}
        </span>

        <span
          className="absolute -right-2 top-4 z-20 block h-[14px] w-[44px] rotate-12 transition-transform duration-500 group-hover:rotate-[16deg]"
          style={{
            background: TAPE_COLOR,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        />

        <Image
          src={product.image}
          alt={product.imageAlt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          style={{ filter: PHOTO_FILTER }}
        />

        {!product.inStock && (
          <span className="font-hand absolute bottom-3 left-3 z-20 bg-background/90 px-2 py-1 text-[12px] font-semibold text-muted-foreground">
            Sold out
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1.5">
        <h3 className="font-crayon text-[22px] leading-[1.2] text-foreground md:text-[24px]">
          {product.name}
        </h3>
        <p className="font-crayon text-[14px] leading-[1.35] text-muted-foreground md:text-[15px]">
          {product.subtitle}
        </p>
        <p
          className="font-crayon pt-1 text-[24px] leading-none tabular-nums md:text-[26px]"
          style={{ color: accent }}
        >
          {formatJPY(product.price)}
        </p>
      </div>
    </Link>
  );
}
