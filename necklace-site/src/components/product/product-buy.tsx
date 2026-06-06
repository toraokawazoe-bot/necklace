"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SizeGuide } from "@/components/product/size-guide";
import { useCart } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

const SIZE_OPTIONS = [
  { cm: 38, label: "首元にフィット", note: "Tシャツの襟ぐりと同じ高さ・女性に多いサイズ" },
  { cm: 41, label: "鎖骨ライン", note: "ゆったり下がる・男性に多いサイズ" },
];

export function ProductBuy({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const [size, setSize] = useState<number>(38);
  const [adding, setAdding] = useState(false);
  const add = useCart((s) => s.add);

  const handleAdd = () => {
    if (disabled) return;
    setAdding(true);
    add(productId, size, 1);
    setTimeout(() => setAdding(false), 600);
  };

  return (
    <div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p
            className="font-marker text-[20px] leading-none md:text-[22px]"
            style={{ color: "var(--bead-olive)" }}
          >
            サイズを選ぶ
          </p>
          <SizeGuide />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {SIZE_OPTIONS.map((s) => {
            const active = size === s.cm;
            return (
              <button
                key={s.cm}
                onClick={() => setSize(s.cm)}
                disabled={disabled}
                className={cn(
                  "flex flex-col items-start gap-1 border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground/60",
                  disabled && "opacity-50",
                )}
              >
                <span className="font-marker text-[26px] leading-none">
                  {s.cm}cm
                </span>
                <span className="font-hand mt-1 text-[14px] font-semibold leading-tight">
                  {s.label}
                </span>
                <span className="font-hand text-[12px] leading-tight opacity-75">
                  {s.note}
                </span>
              </button>
            );
          })}
        </div>
        <p className="font-hand mt-3 text-[12px] leading-[1.6] text-muted-foreground">
          すべてアジャスター付き。±2cm 程度の調整ができます。
        </p>
      </div>

      <div className="mt-6">
        {disabled ? (
          <Button size="lg" variant="outline" disabled className="w-full">
            Sold out
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleAdd}
            disabled={adding}
            className="w-full"
          >
            {adding ? "Added —" : `カートに入れる ・ ${size}cm`}
          </Button>
        )}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <p
          className="font-marker text-[20px] leading-none md:text-[22px]"
          style={{ color: "var(--bead-rust)" }}
        >
          ピッタリのサイズで作りたい？
        </p>
        <p className="font-hand mt-3 text-[15px] leading-[1.85] text-foreground/85">
          首回りを採寸して、ジャストフィットでお作りします。
          <br />
          1cm 単位で調整可能、価格は変わりません。
        </p>
        <a
          href="https://ig.me/m/740nll"
          target="_blank"
          rel="noopener noreferrer"
          className="font-marker mt-3 inline-flex items-center gap-2 text-[18px] underline-offset-4 transition-opacity hover:opacity-75"
          style={{ color: "var(--bead-rust)" }}
        >
          Instagram DM で相談する →
        </a>
      </div>
    </div>
  );
}
