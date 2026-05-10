type Bead = {
  color: string;
  size?: number;
  glow?: boolean;
};

const RADIUS = 180;
const CENTER = 220;

function ring(beads: Bead[], radius: number) {
  return beads.map((bead, i) => {
    const angle = (i / beads.length) * Math.PI * 2 - Math.PI / 2;
    const cx = CENTER + Math.cos(angle) * radius;
    const cy = CENTER + Math.sin(angle) * radius;
    return { ...bead, cx, cy, key: i };
  });
}

const outerBeads: Bead[] = (() => {
  const palette: Bead[] = [
    { color: "#c33b48" },
    { color: "#1f2538" },
    { color: "#dab44e" },
    { color: "#e9e3d4" },
    { color: "#9a8868" },
    { color: "#3a4a8a" },
    { color: "#c33b48" },
    { color: "#dab44e", size: 5 },
    { color: "#1f2538" },
    { color: "#e9e3d4" },
    { color: "#9a8868" },
    { color: "#3a4a8a" },
  ];
  // Repeat the palette to fill 36 beads
  const beads: Bead[] = [];
  for (let i = 0; i < 36; i++) beads.push(palette[i % palette.length]);
  return beads;
})();

const innerBeads: Bead[] = (() => {
  const beads: Bead[] = [];
  for (let i = 0; i < 24; i++) {
    const accent = i % 6 === 0;
    beads.push({
      color: accent ? "#c33b48" : "#cfc8b8",
      size: accent ? 5 : 4,
    });
  }
  return beads;
})();

export function SpinningNecklace({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const outer = ring(outerBeads, RADIUS);
  const inner = ring(innerBeads, RADIUS - 56);
  const isDark = variant === "dark";

  return (
    <svg
      viewBox="0 0 440 440"
      className="h-full w-full"
      role="img"
      aria-label="Beads in a circle, slowly rotating"
    >
      <defs>
        <radialGradient id="bg-soft" cx="50%" cy="50%" r="60%">
          <stop
            offset="0%"
            stopColor={isDark ? "#c33b48" : "#f1ece3"}
            stopOpacity={isDark ? "0.18" : "0.7"}
          />
          <stop
            offset="100%"
            stopColor={isDark ? "#14182a" : "#fafaf7"}
            stopOpacity="0"
          />
        </radialGradient>
      </defs>

      <circle cx={CENTER} cy={CENTER} r="210" fill="url(#bg-soft)" />

      {/* Outer ring — clockwise */}
      <g className="animate-spin-slow" style={{ transformOrigin: "220px 220px" }}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="#d6d2c8"
          strokeWidth="0.5"
          strokeDasharray="2 4"
          opacity="0.6"
        />
        {outer.map((b) => (
          <circle
            key={`o-${b.key}`}
            cx={b.cx}
            cy={b.cy}
            r={b.size ?? 7}
            fill={b.color}
            opacity="0.92"
          />
        ))}
      </g>

      {/* Inner ring — counter-clockwise */}
      <g
        className="animate-spin-slow-reverse"
        style={{ transformOrigin: "220px 220px" }}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS - 56}
          fill="none"
          stroke="#d6d2c8"
          strokeWidth="0.4"
          strokeDasharray="1 5"
          opacity="0.5"
        />
        {inner.map((b) => (
          <circle
            key={`i-${b.key}`}
            cx={b.cx}
            cy={b.cy}
            r={b.size ?? 4}
            fill={b.color}
            opacity="0.85"
          />
        ))}
      </g>

      {/* Center wordmark */}
      <text
        x={CENTER}
        y={CENTER + 6}
        textAnchor="middle"
        fontFamily="'Cormorant Garamond', serif"
        fontSize="18"
        letterSpacing="6"
        fill={isDark ? "#ede4d2" : "#71717a"}
        className="animate-shimmer"
      >
        740NLL
      </text>
    </svg>
  );
}
