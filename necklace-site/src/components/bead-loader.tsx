"use client";

import { useEffect, useState } from "react";

const PALETTE = [
  "var(--bead-blue)",
  "var(--bead-brown)",
  "var(--bead-olive)",
  "var(--bead-cream)",
  "var(--bead-rust)",
  "var(--bead-peach)",
  "var(--bead-charcoal)",
];

const COUNT = 16;
const W = 1000;
const H = 220;
const P0 = { x: 20, y: 70 };
const CP = { x: 500, y: 200 };
const P1 = { x: 980, y: 70 };

function pointAt(t: number) {
  const x = (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * CP.x + t ** 2 * P1.x;
  const y = (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * CP.y + t ** 2 * P1.y;
  return { x, y };
}

const BEADS = Array.from({ length: COUNT }, (_, i) => {
  const t = (i + 1) / (COUNT + 1);
  const { x, y } = pointAt(t);
  const wobble = ((i * 37) % 7) - 3;
  return {
    x: x + wobble * 0.3,
    y: y + wobble * 0.4,
    color: PALETTE[i % PALETTE.length],
    r: 11 + ((i * 13) % 5) * 0.7,
  };
});

const CORD_PATH = `M ${P0.x} ${P0.y} Q ${CP.x} ${CP.y} ${P1.x} ${P1.y}`;
const CORD_MS = 750;
const STAGGER_MS = 110;
const DROP_MS = 850;
const HOLD_MS = 400;
const FADE_MS = 700;

export function BeadLoader({ onReveal }: { onReveal: () => void }) {
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const reveal = CORD_MS + (COUNT - 1) * STAGGER_MS + DROP_MS + HOLD_MS;
    const t = setTimeout(() => {
      setPhase("out");
      onReveal();
    }, reveal);
    return () => clearTimeout(t);
  }, [onReveal]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity ease-out"
      style={{
        opacity: phase === "out" ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-[96vw] max-w-[1200px]"
        fill="none"
      >
        <path
          d={CORD_PATH}
          stroke="var(--bead-charcoal)"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.55"
          className="cord"
        />
        {BEADS.map((b, i) => (
          <g
            key={i}
            className="bead-drop"
            style={{ animationDelay: `${CORD_MS + i * STAGGER_MS}ms` }}
          >
            <circle
              cx={b.x}
              cy={b.y}
              r={b.r}
              fill={b.color}
              stroke="var(--bead-charcoal)"
              strokeWidth="1.4"
            />
            <circle
              cx={b.x - b.r * 0.35}
              cy={b.y - b.r * 0.35}
              r={b.r * 0.22}
              fill="rgba(255,255,255,0.55)"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
