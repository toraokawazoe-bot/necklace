import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: { absolute: "ブランドについて｜740NLL" },
  description:
    "740NLLは、ビーズネックレスとブレスレットを制作・販売しています。制作方法や発送についてご案内します。",
};

const BEAD_COLORS = [
  "var(--bead-blue)",
  "var(--bead-brown)",
  "var(--bead-olive)",
  "var(--bead-rust)",
  "var(--bead-cream)",
  "var(--bead-peach)",
  "var(--bead-charcoal)",
];

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20 md:py-28">
      <Reveal>
        <p
          className="font-marker text-3xl leading-none md:text-4xl"
          style={{ color: "var(--bead-rust)" }}
        >
          About
        </p>
      </Reveal>

      <Reveal delay={120}>
        <h1 className="font-hand mt-7 text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[1.1] tracking-tight">
          <span style={{ color: "var(--bead-blue)" }}>740NLL</span>
          <span style={{ color: "var(--bead-brown)" }}>について</span>
        </h1>
      </Reveal>

      <div className="mt-10 flex items-center gap-3">
        {BEAD_COLORS.map((color, i) => (
          <span
            key={i}
            className="bead block h-3 w-3 rounded-full"
            style={{
              backgroundColor: color,
              animationDelay: `${600 + i * 90}ms`,
              boxShadow: "inset 0 0 0 1px rgba(42,37,32,0.55)",
            }}
          />
        ))}
      </div>

      <div className="mt-14 space-y-7">
        <Reveal delay={400}>
          <p className="font-hand text-[17px] leading-[1.95] text-foreground">
            <span
              className="font-semibold"
              style={{ color: "var(--bead-blue)" }}
            >
              740NLL
            </span>
            （ナナヨンマル・エヌエルエル）は、ビーズネックレスとブレスレットを制作・販売しています。
          </p>
        </Reveal>

        <Reveal delay={480}>
          <p className="font-hand text-[17px] leading-[1.95] text-foreground">
            ビーズの色や素材を組み合わせて、ひとつずつ
            <span
              className="font-semibold"
              style={{ color: "var(--bead-rust)" }}
            >
              手で編んで
            </span>
            います。
          </p>
        </Reveal>

        <Reveal delay={560}>
          <p className="font-hand text-[17px] leading-[1.95] text-foreground">
            手作業のため、同じデザインでもビーズの並びや色合いに少しずつ違いがあります。素材とサイズは、各商品ページでご確認ください。
          </p>
        </Reveal>

        <Reveal delay={620}>
          <p className="font-hand text-[17px] leading-[1.95] text-foreground">
            ネックレスの長さは1cm単位で指定できます。カスタムも同価格です。
          </p>
        </Reveal>

        <Reveal delay={680}>
          <p className="font-hand text-[17px] leading-[1.95] text-foreground">
            ご注文・ご入金の確認後、
            <span
              className="font-semibold"
              style={{ color: "var(--bead-rust)" }}
            >
              通常3〜7営業日以内
            </span>
            に発送します。受注制作などで通常よりお時間をいただく場合は、事前にメールでご連絡します。
          </p>
        </Reveal>

        <Reveal delay={720}>
          <Link
            href="/products"
            className="font-marker inline-flex min-h-11 items-center text-[22px] underline-offset-4 transition-opacity hover:underline hover:opacity-80"
            style={{ color: "var(--bead-blue)" }}
          >
            アクセサリーを見る →
          </Link>
        </Reveal>
      </div>

      <Reveal delay={780}>
        <div className="mt-16 flex items-center gap-3">
          {BEAD_COLORS.slice()
            .reverse()
            .map((color, i) => (
              <span
                key={i}
                className="block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow: "inset 0 0 0 1px rgba(42,37,32,0.4)",
                  opacity: 0.85,
                }}
              />
            ))}
        </div>
      </Reveal>
    </article>
  );
}
