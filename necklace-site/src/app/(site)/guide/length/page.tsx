import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BraceletGuide } from "@/components/product/bracelet-guide";
import { SizeGuideContent } from "@/components/product/size-guide";
import { buttonVariants } from "@/components/ui/button";
import { LINE_URL } from "@/lib/line";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "長さの選び方",
  description:
    "ネックレスはレディース首回り+4cm・メンズ+5cm、ブレスレットは手首回り+1cmが目安。測り方と早見表をまとめました。",
  openGraph: {
    title: "長さの選び方 | 740NLL",
    description:
      "ネックレスはレディース首回り+4cm・メンズ+5cm、ブレスレットは手首回り+1cmが目安。測り方と早見表をまとめました。",
  },
};

const h2 = "font-marker text-2xl leading-none md:text-3xl";

export default function LengthGuidePage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-20 md:py-28">
      <p
        className="font-marker text-3xl leading-none md:text-4xl"
        style={{ color: "var(--bead-olive)" }}
      >
        Size guide
      </p>
      <h1 className="font-hand mt-7 text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[1.1] tracking-tight">
        <span style={{ color: "var(--bead-blue)" }}>長さの</span>
        <span style={{ color: "var(--bead-brown)" }}>選び方</span>
      </h1>

      {/* 測り方 */}
      <section className="mt-12">
        <Image
          src="/illustrations/size-guide.jpg"
          alt="巻いたメジャーと、ビーズのブレスレットのイラスト"
          width={620}
          height={430}
          priority
          className="mx-auto block w-full max-w-[360px]"
        />
        <p className={cn(h2, "mt-10")} style={{ color: "var(--bead-brown)" }}>
          測り方
        </p>
        <ol className="font-hand mt-5 space-y-3 text-[16px] leading-[1.9] text-foreground/85">
          <li className="flex gap-2">
            <span style={{ color: "var(--bead-brown)" }}>1.</span>
            <span>
              ひもや紙テープを、測りたい場所（首・手首）に
              <strong>ゆるくひと巻き</strong>します。
            </span>
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--bead-brown)" }}>2.</span>
            <span>重なったところに印をつけます。</span>
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--bead-brown)" }}>3.</span>
            <span>ひもを伸ばして、定規で印までの長さを測ります。</span>
          </li>
        </ol>
        <p className="font-hand mt-4 text-[16px] leading-[1.9] text-foreground/85">
          手持ちのネックレス・ブレスレットの長さを測る方法もあります。
          ふだんつけて心地いいものを、留め具を留めた状態で平らに置き、
          ぐるっと一周のひもを当てて、その長さを測ってください。
        </p>
      </section>

      {/* ネックレス */}
      <section
        id="necklace"
        className="mt-14 scroll-mt-24 border-t border-border pt-9"
      >
        <p className={h2} style={{ color: "var(--bead-olive)" }}>
          ネックレス
        </p>
        <div className="mt-2">
          <SizeGuideContent />
        </div>
        <div className="mt-8">
          <Link
            href="/products?category=necklace"
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            ネックレスを見る
          </Link>
        </div>
      </section>

      {/* ブレスレット */}
      <section
        id="bracelet"
        className="mt-14 scroll-mt-24 border-t border-border pt-9"
      >
        <p className={h2} style={{ color: "var(--bead-rust)" }}>
          ブレスレット
        </p>
        <div className="mt-5">
          <BraceletGuide />
        </div>
        <div className="mt-8">
          <Link
            href="/products?category=bracelet"
            className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
          >
            ブレスレットを見る
          </Link>
        </div>
      </section>

      {/* メガネチェーン */}
      <section
        id="glasses-chain"
        className="mt-14 scroll-mt-24 border-t border-border pt-9"
      >
        <p className={h2} style={{ color: "var(--bead-blue)" }}>
          メガネチェーン
        </p>
        <p className="font-hand mt-5 text-[16px] leading-[1.9] text-foreground/85">
          メガネチェーンは、長さを選ぶ必要はありません。
        </p>
      </section>

      {/* 迷ったら */}
      <section
        className="mt-14 rounded-xl px-5 py-6"
        style={{ background: "rgba(239,217,176,0.35)" }}
      >
        <p
          className="font-marker text-[22px] leading-[1.3]"
          style={{ color: "var(--bead-rust)" }}
        >
          迷ったら
        </p>
        <p className="font-hand mt-3 text-[16px] leading-[1.9] text-foreground/85">
          迷ったら、LINEで相談してください。
        </p>
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "mt-4 w-full sm:w-auto",
          )}
        >
          LINEで相談する
        </a>
      </section>
    </article>
  );
}
