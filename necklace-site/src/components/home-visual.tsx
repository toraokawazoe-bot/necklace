"use client";

import Image from "next/image";
import { useState } from "react";
import type { CSSProperties } from "react";
import { BeadLoader } from "@/components/bead-loader";

type Bead = {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  size: number;
  color: string;
  delay: string;
};

const FLOATING_BEADS: Bead[] = [
  { top: "10%", left: "5%", size: 11, color: "var(--bead-blue)", delay: "-0.6s" },
  { top: "22%", right: "7%", size: 9, color: "var(--bead-rust)", delay: "-2.1s" },
  { bottom: "20%", left: "3%", size: 12, color: "var(--bead-olive)", delay: "-3.5s" },
  { bottom: "12%", right: "9%", size: 8, color: "var(--bead-brown)", delay: "-5s" },
];

const TAPE_COLOR = "rgba(239,217,176,0.72)";

const Sparkle = ({
  className,
  color,
  delay,
}: {
  className?: string;
  color: string;
  delay?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill={color}
    style={delay ? ({ "--twinkle-delay": delay } as CSSProperties) : undefined}
  >
    <path d="M 12 0 L 13.5 10.5 L 24 12 L 13.5 13.5 L 12 24 L 10.5 13.5 L 0 12 L 10.5 10.5 Z" />
  </svg>
);

const Squiggle = ({
  className,
  color,
}: {
  className?: string;
  color: string;
}) => (
  <svg
    viewBox="0 0 60 14"
    className={className}
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M 2 7 Q 12 2 22 7 T 42 7 T 58 7" />
  </svg>
);

const MARQUEE_TEXT =
  "Handmade in Tokyo · 一点ずつ手で編む · ¥2,500 each · 送料一律 ¥150 · One at a time · ";

export function HomeVisual() {
  const [revealed, setRevealed] = useState(false);
  const opacity = revealed ? "opacity-100" : "opacity-0";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Desktop image with tape + signature */}
      <div
        className={`absolute inset-0 hidden items-center justify-center transition-opacity duration-700 ease-out md:flex ${opacity}`}
      >
        <div className="relative h-full w-full max-h-[70vh] max-w-[min(115vh,82vw)]">
          <span
            className="absolute -left-3 -top-2 z-10 block h-[20px] w-[64px] -rotate-12 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            style={{ background: TAPE_COLOR }}
          />
          <span
            className="absolute -bottom-2 -right-3 z-10 block h-[20px] w-[64px] rotate-[8deg] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            style={{ background: TAPE_COLOR }}
          />
          <Image
            src="/illustrations/main-desktop.png"
            alt="ビーズチョーカーを着けた3人のイラスト"
            fill
            priority
            sizes="82vw"
            className="object-contain"
          />
          <span className="font-hand absolute bottom-2 right-3 z-10 text-[13px] tracking-wide text-foreground/55">
            740NLL — &apos;26
          </span>
        </div>
      </div>

      {/* Mobile image with tape + signature */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-out md:hidden ${opacity}`}
      >
        <div className="relative h-full w-full max-h-[82vh] max-w-[min(78vh,92vw)]">
          <span
            className="absolute -left-2 -top-1 z-10 block h-[14px] w-[44px] -rotate-12 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            style={{ background: TAPE_COLOR }}
          />
          <span
            className="absolute -bottom-1 -right-2 z-10 block h-[14px] w-[44px] rotate-[8deg] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            style={{ background: TAPE_COLOR }}
          />
          <Image
            src="/illustrations/main-mobile.png"
            alt="ビーズチョーカーを着けた3人のイラスト"
            fill
            priority
            sizes="82vw"
            className="object-contain"
          />
          <span className="font-hand absolute bottom-1.5 right-2 z-10 text-[11px] tracking-wide text-foreground/55">
            740NLL — &apos;26
          </span>
        </div>
      </div>

      {/* Floating decorations layer */}
      <div className="pointer-events-none absolute inset-0">
        {FLOATING_BEADS.map((b, i) => (
          <span
            key={i}
            className="float-bead absolute block rounded-full"
            style={
              {
                top: b.top,
                left: b.left,
                right: b.right,
                bottom: b.bottom,
                width: `${b.size}px`,
                height: `${b.size}px`,
                backgroundColor: b.color,
                boxShadow: "inset 0 0 0 1px rgba(42,37,32,0.55)",
                "--bead-delay": b.delay,
              } as CSSProperties
            }
          />
        ))}

        <Sparkle
          className="deco-twinkle absolute right-[20%] top-[6%] h-3.5 w-3.5"
          color="var(--bead-rust)"
        />
        <Sparkle
          className="deco-twinkle absolute bottom-[26%] left-[16%] h-3 w-3"
          color="var(--bead-blue)"
          delay="-2.5s"
        />

        <Squiggle
          className="deco-fade-in absolute right-[6%] top-[16%] h-3 w-10 md:w-12"
          color="var(--bead-olive)"
        />
        <Squiggle
          className="deco-fade-in absolute bottom-[8%] left-[6%] h-3 w-10 rotate-[8deg] md:w-12"
          color="var(--bead-brown)"
        />
      </div>

      {/* Bottom marquee strip — handwriting tagline */}
      <div className="deco-fade-in pointer-events-none absolute inset-x-0 bottom-0 z-0 overflow-hidden">
        <div className="font-hand animate-marquee inline-block whitespace-nowrap text-[11px] text-foreground/55">
          {MARQUEE_TEXT.repeat(6)}
        </div>
      </div>

      <BeadLoader onReveal={() => setRevealed(true)} />
    </div>
  );
}
