"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Plus, Minus } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import type { Product } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { formatJPY } from "@/lib/utils";
import { readFirstRef } from "@/lib/first-ref";
import { classifyUserAgent } from "@/lib/abandoned-core";
import { displayName, displaySubtitle, imageAlt } from "@/lib/product-display";

// 送料(全国一律)。チェックアウトAPI(shipping_options)の金額と合わせる。
const SHIPPING_FEE = 150;
import { isValidSize, resolveCategory, sizeLabel } from "@/lib/product-category";

export function CartDrawer() {
  const { lines, isOpen, close, setQty, remove, hydrated } = useCart();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  // 決済ページへ移動中。Stripe から戻る(bfcache 復元)時は pageshow で解除する。
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Instagram・Threads 等のアプリ内ブラウザか(決済の案内を出すため)
  const [inAppApp, setInAppApp] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  // クーポン: 入力中の文字と、サーバーで確認できた適用結果
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setCoupon] = useState<{
    code: string;
    discount: number;
    sig: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    const d = classifyUserAgent(navigator.userAgent);
    if (d.inApp) setInAppApp(d.app);
    fetch("/api/products")
      .then((res) => res.json())
      .then((data: { products?: Product[] }) => {
        if (Array.isArray(data.products)) setProducts(data.products);
      })
      .catch((e) => console.error("[cart] product fetch failed:", e));
  }, []);

  useEffect(() => {
    // iOS Safari は戻るボタンで bfcache から復元され、「Redirecting…」の状態のまま固まることがある
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setIsPending(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  if (!mounted) return null;

  const cartItems = lines
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return null;
      return { line, product };
    })
    .filter(
      (x): x is { line: typeof lines[number]; product: Product } => x !== null,
    );

  // 商品カテゴリと長さの組み合わせが合わない行(例: ブレスレットに 38cm が残っている)
  const isLineInvalid = ({ line, product }: (typeof cartItems)[number]) =>
    !isValidSize(resolveCategory(product.category), line.size);
  const hasInvalid = cartItems.some(isLineInvalid);

  const subtotal = cartItems.reduce(
    (sum, { line, product }) => sum + line.qty * product.price,
    0,
  );

  // カートの中身が変わったら、確認済みの割引は外す(再度「適用」すると計算し直す)。サーバーは決済時にも計算し直す。
  const cartSignature = lines.map((l) => `${l.productId}:${l.size}:${l.qty}`).join("|");
  const coupon = appliedCoupon?.sig === cartSignature ? appliedCoupon : null;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupon/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          lines: cartItems.map(({ line, product }) => ({
            productId: product.id,
            qty: line.qty,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        discount?: number;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.code || !data.discount) {
        setCoupon(null);
        setCouponError(data.error ?? "クーポンを確認できませんでした。");
        return;
      }
      setCoupon({ code: data.code, discount: data.discount, sig: cartSignature });
      setCouponInput("");
    } catch {
      setCouponError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setCouponBusy(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 3000);
    } catch {
      setError("URLをコピーできませんでした。画面右上のメニューからブラウザで開いてください。");
    }
  };

  const handleCheckout = () => {
    setError(null);
    if (cartItems.length === 0) {
      setError("カートが空です。商品を追加してから再度お試しください。");
      return;
    }
    if (hasInvalid) {
      setError("長さの合わない商品があります。商品ページで長さを選び直してください。");
      return;
    }
    setIsPending(true);
    void (async () => {
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: cartItems.map(({ line, product }) => ({
              productId: product.id,
              size: line.size,
              qty: line.qty,
            })),
            ...(coupon ? { couponCode: coupon.code } : {}),
            ...(inAppApp ? { inAppNotice: true } : {}),
            ...(inAppApp ? { inAppNotice: true } : {}),
            ...(readFirstRef() ? { ref: readFirstRef() } : {}),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            data.error ?? `決済の準備に失敗しました（HTTP ${res.status}）`,
          );
        }
        if (data.url) {
          window.location.assign(data.url);
        } else {
          throw new Error("Checkout URL が返されませんでした");
        }
      } catch (e) {
        console.error("[checkout]", e);
        setError(e instanceof Error ? e.message : "想定外のエラーが発生しました");
        setIsPending(false);
      }
    })();
  };

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={close}
        className={`fixed inset-0 z-40 bg-foreground/30 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-label="カート"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-background transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="wordmark text-sm">カート</h2>
          <button
            onClick={close}
            aria-label="閉じる"
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!hydrated ? null : cartItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="font-hand text-2xl text-foreground">
                カート
              </p>
              <p className="text-sm text-muted-foreground">
                カートに商品は入っていません。
              </p>
              <Link href="/products" onClick={close}>
                <Button variant="outline">アクセサリーを見る</Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {cartItems.map(({ line, product }) => (
                <li
                  key={`${product.id}-${line.size}`}
                  className="flex gap-4 px-6 py-5"
                >
                  <Link
                    href={`/products/${product.slug}`}
                    onClick={close}
                    className="relative block h-24 w-20 flex-shrink-0 overflow-hidden bg-muted"
                    style={{ backgroundColor: product.imageBg }}
                  >
                    <Image
                      src={product.image}
                      alt={imageAlt(product.name, product.category)}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </Link>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <Link
                        href={`/products/${product.slug}`}
                        onClick={close}
                        className="block font-hand text-lg leading-tight"
                      >
                        {displayName(product.name)}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {displaySubtitle(product.name, product.subtitle)}
                      </p>
                      {isLineInvalid({ line, product }) ? (
                        <p className="mt-1 text-xs text-red-700" role="alert">
                          長さを選び直してください（
                          <Link
                            href={`/products/${product.slug}`}
                            onClick={close}
                            className="underline"
                          >
                            商品ページへ
                          </Link>
                          ）
                        </p>
                      ) : sizeLabel(resolveCategory(product.category), line.size) ? (
                        <p
                          className="font-marker mt-1 text-[16px] leading-none"
                          style={{ color: "var(--bead-olive)" }}
                        >
                          {line.size}cm
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm">
                        {formatJPY(product.price)}（税込）
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center border border-border">
                        <button
                          aria-label="数量を減らす"
                          onClick={() =>
                            setQty(product.id, line.size, line.qty - 1)
                          }
                          className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">
                          {line.qty}
                        </span>
                        <button
                          aria-label="数量を増やす"
                          onClick={() =>
                            setQty(product.id, line.size, line.qty + 1)
                          }
                          className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => remove(product.id, line.size)}
                        className="min-h-11 px-1 text-xs tracking-widest text-muted-foreground hover:text-foreground"
                      >
                        カートから削除
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cartItems.length > 0 && (
          <footer className="border-t border-border px-6 py-5">
            {coupon ? (
              <div className="mb-4 flex items-center justify-between gap-3 text-[16px]">
                <span className="break-all">
                  クーポン <span className="font-mono">{coupon.code}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums">−{formatJPY(coupon.discount)}</span>
                  <button
                    type="button"
                    onClick={() => setCoupon(null)}
                    className="min-h-11 px-1 text-[16px] underline underline-offset-4"
                  >
                    外す
                  </button>
                </span>
              </div>
            ) : (
              <div className="mb-4">
                <label htmlFor="cart-coupon" className="block text-[16px]">
                  クーポンコード
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="cart-coupon"
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void applyCoupon();
                    }}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="740-XXXXXX"
                    disabled={couponBusy || isPending}
                    className="min-h-11 min-w-0 flex-1 border border-border bg-transparent px-3 font-mono text-[16px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 px-5 text-[16px]"
                    onClick={() => void applyCoupon()}
                    disabled={couponBusy || isPending || !couponInput.trim()}
                  >
                    {couponBusy ? "確認中…" : "適用"}
                  </Button>
                </div>
                {couponError && (
                  <p className="mt-2 text-[16px] leading-snug text-red-700" role="alert">
                    {couponError}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-xs tracking-widest text-muted-foreground">
                商品小計
              </span>
              <span className="font-hand text-2xl">{formatJPY(subtotal)}</span>
            </div>
            {coupon && (
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs tracking-widest text-muted-foreground">
                  クーポン適用後
                </span>
                <span className="font-hand text-xl">
                  {formatJPY(Math.max(0, subtotal - coupon.discount))}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xs tracking-widest text-muted-foreground">
                送料
              </span>
              <span className="font-hand text-xl">{formatJPY(SHIPPING_FEE)}</span>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-xs tracking-widest text-muted-foreground">
                合計（税込）
              </span>
              <span className="font-hand text-2xl">
                {formatJPY(
                  Math.max(0, subtotal - (coupon?.discount ?? 0)) + SHIPPING_FEE,
                )}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              送料は全国一律です。クーポンの対象外です。
            </p>
            {error && (
              <p className="mt-3 text-xs text-red-700" role="alert">
                {error}
              </p>
            )}
            {inAppApp && (
              <div className="mt-4 border border-border px-3 py-3" role="note">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {inAppApp === "Instagram" || inAppApp === "Threads"
                    ? "Instagram・Threadsのアプリ内ブラウザでは、PayPayの画面に移れないことがあります。"
                    : "アプリ内ブラウザでは、PayPayの画面に移れないことがあります。"}
                  右上のメニューから『ブラウザで開く』を選ぶと、スムーズにお支払いいただけます。
                </p>
                <button
                  type="button"
                  onClick={() => void copyUrl()}
                  className="mt-1 min-h-11 text-xs underline underline-offset-4"
                >
                  {urlCopied ? "コピーしました" : "URLをコピー"}
                </button>
              </div>
            )}
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={isPending || hasInvalid}
            >
              {isPending ? "お支払い画面へ移動しています…" : "購入手続きへ"}
            </Button>
          </footer>
        )}
      </aside>
    </>
  );
}
