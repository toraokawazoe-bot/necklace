import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = {
  title: "About",
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
          <span style={{ color: "var(--bead-blue)" }}>ひとつずつ、</span>
          <br className="md:hidden" />
          <span style={{ color: "var(--bead-brown)" }}>手で。</span>
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
            （ナナヨンマル・エヌエルエル）は、ビーズを糸で編んだチョーカーをひとつずつ
            <span
              className="font-semibold"
              style={{ color: "var(--bead-rust)" }}
            >
              手仕事
            </span>
            で作っています。
            T シャツの首元に控えめだけど効く、毎日着けてしまうような一本を。
          </p>
        </Reveal>

        <Reveal delay={520}>
          <p className="font-hand text-[17px] leading-[1.95] text-foreground">
            <span style={{ color: "var(--bead-olive)" }}>ガラスビーズ</span>、
            <span style={{ color: "var(--bead-brown)" }}>ターコイズ</span>、
            <span style={{ color: "var(--bead-charcoal)" }}>メタル</span>
            など、その日手に取った素材で並びを決めているので、
            同じデザインでも一点ずつ表情が少し違います。
          </p>
        </Reveal>

        <Reveal delay={640}>
          <p className="font-hand text-[17px] leading-[1.95] text-foreground">
            注文を受けてから
            <span
              className="font-semibold"
              style={{ color: "var(--bead-rust)" }}
            >
              編み始める
            </span>
            こともあり、お届けまで少しお時間をいただくことがあります。
            手元に届くまで、よろしければ
            <span
              className="font-semibold"
              style={{ color: "var(--bead-brown)" }}
            >
              ゆっくりお待ちください
            </span>
            。
          </p>
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
