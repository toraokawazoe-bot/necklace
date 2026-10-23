import Link from "next/link";
import { CartButton } from "@/components/cart/cart-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6 md:px-10">
        <Link
          href="/"
          className="wordmark-tight text-[13px] tracking-[0.18em]"
        >
          740NLL
        </Link>
        <nav className="flex items-center gap-3.5 sm:gap-6 md:gap-8">
          <Link
            href="/products"
            aria-label="商品一覧"
            className="font-marker text-[22px] leading-none sm:text-2xl transition-colors hover:opacity-80"
            style={{ color: "var(--bead-blue)" }}
          >
            Shop
          </Link>
          <Link
            href="/about"
            aria-label="ブランドについて"
            className="font-marker text-[22px] leading-none sm:text-2xl transition-colors hover:opacity-80"
            style={{ color: "var(--bead-brown)" }}
          >
            About
          </Link>
          <Link
            href="/care"
            aria-label="お手入れ"
            className="font-marker text-[22px] leading-none sm:text-2xl transition-colors hover:opacity-80"
            style={{ color: "var(--bead-olive)" }}
          >
            Care
          </Link>
          <a
            href="https://www.instagram.com/740nll/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram（新しいタブで開きます）"
            className="font-marker text-[22px] leading-none sm:text-2xl transition-colors hover:opacity-80"
            style={{ color: "var(--bead-rust)" }}
          >
            Instagram
          </a>
          <CartButton />
        </nav>
      </div>
    </header>
  );
}
