import type { Metadata } from "next";
import {
  Inter,
  Cormorant_Garamond,
  Klee_One,
  Caveat,
} from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { CartProvider } from "@/components/cart/cart-provider";
import { PageTracker } from "@/components/analytics/page-tracker";

const sans = Inter({
  variable: "--font-sans-stack",
  subsets: ["latin"],
  display: "swap",
});

const serif = Cormorant_Garamond({
  variable: "--font-serif-stack",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  display: "swap",
});

const hand = Klee_One({
  variable: "--font-hand-stack",
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
});

const marker = Caveat({
  variable: "--font-marker-stack",
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const crayon = localFont({
  src: "../../public/fonts/nagurigaki-crayon.ttf",
  variable: "--font-crayon-stack",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.740nll.store"),
  title: {
    default: "740NLL — Handmade beaded chokers",
    template: "%s · 740NLL",
  },
  description:
    "一点ずつ手で編むビーズチョーカー。Tシャツの首元にちょうど効く、控えめな一本を。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${sans.variable} ${serif.variable} ${hand.variable} ${marker.variable} ${crayon.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <CartProvider>{children}</CartProvider>
        <PageTracker />
        <Analytics />
        <svg
          aria-hidden
          className="pointer-events-none absolute -z-10 h-0 w-0 overflow-hidden"
        >
          <defs>
            <filter
              id="crayon"
              x="-3%"
              y="-3%"
              width="106%"
              height="106%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.85"
                numOctaves="2"
                seed="5"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="1.6"
              />
            </filter>
            <filter
              id="crayon-soft"
              x="-3%"
              y="-3%"
              width="106%"
              height="106%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.7"
                numOctaves="2"
                seed="3"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="0.9"
              />
            </filter>
          </defs>
        </svg>
      </body>
    </html>
  );
}
