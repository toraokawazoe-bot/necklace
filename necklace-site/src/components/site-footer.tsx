import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-border">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-14 md:flex-row md:items-end md:justify-between md:px-10">
        <div className="max-w-sm">
          <p className="wordmark-tight text-[13px]">740NLL</p>
          <p className="font-hand mt-4 text-[15px] leading-relaxed text-muted-foreground">
            ビーズネックレスとブレスレットを、ひとつずつ手で編んでいます。
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-7 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <Link href="/products" className="hover:text-foreground">
            商品一覧
          </Link>
          <Link href="/about" className="hover:text-foreground">
            ブランドについて
          </Link>
          <Link href="/care" className="hover:text-foreground">
            お手入れ
          </Link>
          <Link href="/legal/tokushoho" className="hover:text-foreground">
            特定商取引法に基づく表記
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground">
            プライバシーポリシー
          </Link>
          <a
            href="https://www.instagram.com/740nll/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            Instagram
          </a>
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 pb-8 text-[10px] uppercase tracking-[0.22em] text-muted-foreground md:px-10">
        <span>© {new Date().getFullYear()} 740NLL</span>
        <span>Handmade</span>
      </div>
    </footer>
  );
}
