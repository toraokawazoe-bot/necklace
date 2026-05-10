import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "Care guide",
};

const ITEMS = [
  {
    en: "Sweat & water",
    jp: "汗・水濡れ",
    body: "入浴・運動・サウナの際は外してください。汗や塩素はビーズやコードの劣化につながります。",
    color: "var(--bead-blue)",
  },
  {
    en: "Storage",
    jp: "保管",
    body: "チェーンや他のジュエリーと一緒にせず、ポーチや小箱に入れて単体で保管してください。",
    color: "var(--bead-brown)",
  },
  {
    en: "Cosmetics",
    jp: "化粧品・香水",
    body: "スプレー類が直接かからないように、身支度の最後に着けてください。",
    color: "var(--bead-olive)",
  },
  {
    en: "Repair",
    jp: "コードのほつれ",
    body: "長く使うとアジャスター部分のコードが傷んでくることがあります。気になったら DM でご連絡ください。修繕を承ります。",
    color: "var(--bead-rust)",
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
          Care guide
        </p>
      </Reveal>

      <Reveal delay={120}>
        <h1 className="font-hand mt-7 text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[1.1] tracking-tight">
          <span style={{ color: "var(--bead-olive)" }}>長く使う</span>
          <br className="md:hidden" />
          <span style={{ color: "var(--bead-brown)" }}>ために。</span>
        </h1>
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
            </li>
          </Reveal>
        ))}
      </ul>
    </article>
  );
}
