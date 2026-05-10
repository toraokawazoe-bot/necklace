import Link from "next/link";
import { HomeVisual } from "@/components/home-visual";

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <main className="fixed inset-0">
      {/* CENTER VISUAL */}
      <div className="absolute inset-x-14 inset-y-24 flex items-center justify-center md:inset-x-24 md:inset-y-32">
        <HomeVisual />
      </div>

      {/* TOP-LEFT — wordmark */}
      <span className="wordmark-tight absolute left-6 top-6 text-[12px] text-foreground md:left-10 md:top-8 md:text-[13px]">
        740NLL
      </span>

      {/* TOP-RIGHT — small handwritten caption */}
      <span className="font-hand absolute right-6 top-6 text-[13px] text-foreground/75 md:right-10 md:top-8 md:text-[14px]">
        Handmade
      </span>

      {/* BOTTOM-LEFT — © */}
      <span className="absolute bottom-6 left-6 text-[10px] uppercase tracking-[0.22em] text-foreground/65 md:bottom-8 md:left-10">
        © {year} 740NLL
      </span>

      {/* BOTTOM-RIGHT — handwritten note */}
      <span className="font-hand absolute bottom-6 right-6 text-[13px] text-foreground/75 md:bottom-8 md:right-10 md:text-[14px]">
        in Tokyo
      </span>

      {/* TOP-CENTER — SHOP */}
      <Link
        href="/products"
        className="group absolute left-1/2 top-5 inline-flex -translate-x-1/2 flex-col items-center gap-0.5 leading-none md:top-8"
        aria-label="Shop"
        style={{ color: "var(--bead-blue)" }}
      >
        <span className="font-hand text-xl font-semibold leading-none opacity-70 transition-opacity group-hover:opacity-100 md:text-2xl">
          ↑
        </span>
        <span className="font-marker text-4xl leading-none transition-transform group-hover:-translate-y-0.5 md:text-5xl">
          Shop
        </span>
      </Link>

      {/* MIDDLE-LEFT — INSTAGRAM (vertical) */}
      <a
        href="https://www.instagram.com/740nll/"
        target="_blank"
        rel="noopener noreferrer"
        className="group absolute left-4 top-1/2 -translate-y-1/2 md:left-10"
        aria-label="Instagram"
        style={{ color: "var(--bead-rust)" }}
      >
        <span className="font-marker block rotate-180 text-3xl transition-transform group-hover:translate-x-0.5 [writing-mode:vertical-rl] md:text-4xl">
          Instagram
        </span>
      </a>

      {/* MIDDLE-RIGHT — ABOUT (vertical) */}
      <Link
        href="/about"
        className="group absolute right-10 top-1/2 -translate-y-1/2 md:right-20"
        style={{ color: "var(--bead-brown)" }}
      >
        <span className="font-marker block text-3xl transition-transform group-hover:translate-x-0.5 [writing-mode:vertical-rl] md:text-4xl">
          About
        </span>
      </Link>

      {/* BOTTOM-CENTER — CARE */}
      <Link
        href="/care"
        className="group absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 flex-col items-center gap-0.5 leading-none md:bottom-8"
        aria-label="Care"
        style={{ color: "var(--bead-olive)" }}
      >
        <span className="font-marker text-4xl leading-none transition-transform group-hover:translate-y-0.5 md:text-5xl">
          Care
        </span>
        <span className="font-hand text-xl font-semibold leading-none opacity-70 transition-opacity group-hover:opacity-100 md:text-2xl">
          ↓
        </span>
      </Link>
    </main>
  );
}
