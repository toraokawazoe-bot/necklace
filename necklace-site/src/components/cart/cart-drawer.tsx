"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Plus, Minus } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { products } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { formatJPY } from "@/lib/utils";

export function CartDrawer() {
  const { lines, isOpen, close, setQty, remove, hydrated } = useCart();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
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
      (x): x is { line: typeof lines[number]; product: typeof products[number] } =>
        x !== null,
    );

  const subtotal = cartItems.reduce(
    (sum, { line, product }) => sum + line.qty * product.price,
    0,
  );

  const handleCheckout = () => {
    setError(null);
    if (cartItems.length === 0) {
      setError("カートが空です。商品を追加してから再度お試しください。");
      return;
    }
    startTransition(async () => {
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
      }
    });
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
          <h2 className="wordmark text-sm">Cart</h2>
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
                Your cart is quiet.
              </p>
              <p className="text-sm text-muted-foreground">
                まだ何も入っていません。
              </p>
              <Link href="/products" onClick={close}>
                <Button variant="outline">商品を見る</Button>
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
                      alt={product.imageAlt}
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
                        {product.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {product.subtitle}
                      </p>
                      <p
                        className="font-marker mt-1 text-[16px] leading-none"
                        style={{ color: "var(--bead-olive)" }}
                      >
                        {line.size}cm
                      </p>
                      <p className="mt-2 text-sm">
                        {formatJPY(product.price)}
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
                        className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
                      >
                        Remove
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
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Subtotal
              </span>
              <span className="font-hand text-2xl">{formatJPY(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              送料・税は次の画面で計算されます。
            </p>
            {error && (
              <p className="mt-3 text-xs text-red-700" role="alert">
                {error}
              </p>
            )}
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={isPending}
            >
              {isPending ? "Redirecting…" : "Checkout"}
            </Button>
          </footer>
        )}
      </aside>
    </>
  );
}
