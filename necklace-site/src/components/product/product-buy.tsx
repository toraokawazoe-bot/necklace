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

// カスタム長さの範囲(チェックアウトAPI側のバリデーションと合わせる)
const CUSTOM_MIN = 33;
const CUSTOM_MAX = 50;
const CUSTOM_SIZES = Array.from(
  { length: CUSTOM_MAX - CUSTOM_MIN + 1 },
  (_, i) => CUSTOM_MIN + i,
);

export function ProductBuy({
  productId,
  disabled,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const [size, setSize] = useState<number>(38);
  const [isCustom, setIsCustom] = useState(false);
  const [customSize, setCustomSize] = useState<number>(40);
  const [adding, setAdding] = useState(false);
  const add = useCart((s) => s.add);

  const effectiveSize = isCustom ? customSize : size;

  const handleAdd = () => {
    if (disabled) return;
    setAdding(true);
    add(productId, effectiveSize, 1);
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
            const active = !isCustom && size === s.cm;
            return (
              <button
                key={s.cm}
                onClick={() => {
                  setIsCustom(false);
                  setSize(s.cm);
                }}
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

          {/* カスタム長さ */}
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-pressed={isCustom}
            onClick={() => !disabled && setIsCustom(true)}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsCustom(true);
              }
            }}
            className={cn(
              "col-span-2 flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 border px-4 py-3 text-left transition-colors",
              isCustom
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground/60",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <span className="font-marker text-[20px] leading-none">
              カスタム
            </span>
            <span className="font-hand text-[13px] leading-tight opacity-75">
              1cm単位で好きな長さに・同価格
            </span>
            {isCustom && (
              <span className="ml-auto flex items-center gap-1.5">
                <select
                  value={customSize}
                  onChange={(e) => setCustomSize(Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  disabled={disabled}
                  aria-label="長さを選ぶ"
                  className="font-marker rounded-md border border-background/40 bg-transparent px-2 py-1 text-[18px] leading-none text-background"
                >
                  {CUSTOM_SIZES.map((cm) => (
                    <option key={cm} value={cm} className="text-foreground">
                      {cm}
                    </option>
                  ))}
                </select>
                <span className="font-hand text-[14px]">cm</span>
              </span>
            )}
          </div>
        </div>
        {isCustom && (
          <p className="font-hand mt-2 text-[12px] leading-[1.6] text-muted-foreground">
            目安: 首回り +5cm で首元フィット、+8cm で鎖骨ライン
          </p>
        )}
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
            {adding ? "Added —" : `カートに入れる ・ ${effectiveSize}cm`}
          </Button>
        )}
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <p
          className="font-marker text-[20px] leading-none md:text-[22px]"
          style={{ color: "var(--bead-rust)" }}
        >
          どの長さがいいか迷ったら
        </p>
        <p className="font-hand mt-3 text-[15px] leading-[1.85] text-foreground/85">
          好きな長さは上の「カスタム」から 1cm 単位で指定できます。
          <br />
          測り方がわからない・相談したい方はお気軽に DM へどうぞ。
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
