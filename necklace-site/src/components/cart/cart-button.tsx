"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";

export function CartButton() {
  const { lines, open, hydrated } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const showCount = mounted && hydrated && count > 0;

  return (
    <button
      onClick={open}
      aria-label={`カートを開く${count > 0 ? `（${count}点）` : ""}`}
      className="relative flex items-center gap-2 text-sm text-foreground hover:opacity-70"
    >
      <ShoppingBag size={18} strokeWidth={1.5} />
      <span className="hidden sm:inline text-xs uppercase tracking-widest">
        Cart
      </span>
      {showCount && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-medium text-background tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
