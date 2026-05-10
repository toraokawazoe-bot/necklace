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
        <nav className="flex items-center gap-6 md:gap-8">
          <Link
            href="/products"
            className="font-marker text-2xl leading-none transition-colors hover:opacity-80"
            style={{ color: "var(--bead-blue)" }}
          >
            Shop
          </Link>
          <Link
            href="/about"
            className="font-marker text-2xl leading-none transition-colors hover:opacity-80"
            style={{ color: "var(--bead-brown)" }}
          >
            About
          </Link>
          <a
            href="https://www.instagram.com/740nll/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-marker text-2xl leading-none transition-colors hover:opacity-80"
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
