import "./globals.css";
import type { Metadata, Viewport } from "next";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "オーダー管理",
  description: "ハンドメイドネックレス・ブレスレットのオーダー管理アプリ",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // ピンチズームを禁止しない（WCAG 1.4.4対応）。maximumScale/userScalableは指定しない。
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
