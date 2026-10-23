import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: { absolute: "お手入れと修繕について｜740NLL" },
  description:
    "ビーズアクセサリーのお手入れと保管方法。コードのほつれなど、修繕のご相談も承ります。",
};

const ITEMS = [
  {
    en: "Sweat & water",
    jp: "汗・水濡れ",
    body: "入浴や運動、サウナのときは外してください。汗や水、塩素は、ビーズやコードが傷む原因になります。",
    color: "var(--bead-blue)",
  },
  {
    en: "Cosmetics",
    jp: "化粧品・香水",
    body: "香水やヘアスプレーが直接かからないよう、身支度の最後に着けてください。",
    color: "var(--bead-olive)",
  },
  {
    en: "Storage",
    jp: "保管",
    body: "ほかのアクセサリーと絡まないよう、ポーチや小箱に分けて保管してください。",
    color: "var(--bead-brown)",
  },
  {
    en: "Repair",
    jp: "コードの傷み・修繕",
    body: "使い続けるうちに、アジャスター部分のコードが傷むことがあります。ほつれなどが気になったら、InstagramのDMでご相談ください。修繕を承ります。",
    color: "var(--bead-rust)",
    link: { href: "https://ig.me/m/740nll", label: "修繕について相談する" },
  },
];

export default function CarePage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20 md:py-28">
      <Reveal>
        <p
          className="font-marker text-3xl leading-none md:text-4xl"
          style={{ color: "var(--bead-olive)" }}
        >
          Care
        </p>
      </Reveal>

      <Reveal delay={120}>
        <h1 className="font-hand mt-7 text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[1.1] tracking-tight">
          <span style={{ color: "var(--bead-olive)" }}>お手入れと</span>
          <span style={{ color: "var(--bead-brown)" }}>修繕</span>
        </h1>
      </Reveal>

      <Reveal delay={200}>
        <p className="font-hand mt-8 text-[17px] leading-[1.95] text-foreground/85">
          使用時の注意点と、保管・修繕についてご案内します。
        </p>
      </Reveal>

      <ul className="mt-14 space-y-9">
        {ITEMS.map((item, i) => (
          <Reveal key={item.en} delay={300 + i * 140}>
            <li className="relative border-t border-border pt-7">
              <span
                className="bead absolute -top-2 left-0 block h-4 w-4 rounded-full"
                style={{
                  backgroundColor: item.color,
                  animationDelay: `${600 + i * 140}ms`,
                  boxShadow: "inset 0 0 0 1px rgba(42,37,32,0.55)",
                }}
              />
              <p
                className="font-marker text-2xl leading-none md:text-3xl"
                style={{ color: item.color }}
              >
                {item.en}
              </p>
              <p
                className="font-hand mt-3 text-[18px] font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                {item.jp}
              </p>
              <p className="font-hand mt-3 text-[16px] leading-[1.95] text-foreground/85">
                {item.body}
              </p>
              {item.link && (
                <a
                  href={item.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-marker mt-3 inline-flex min-h-11 items-center text-[18px] underline-offset-4 transition-opacity hover:underline hover:opacity-80"
                  style={{ color: item.color }}
                >
                  {item.link.label} →
                </a>
              )}
            </li>
          </Reveal>
        ))}
      </ul>
    </article>
  );
}
