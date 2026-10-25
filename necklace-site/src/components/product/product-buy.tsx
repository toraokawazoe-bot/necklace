"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SizeGuide } from "@/components/product/size-guide";
import { useCart } from "@/lib/cart-store";
import { cn } from "@/lib/utils";
import {
  BRACELET_DEFAULT,
  BRACELET_SIZES,
  NO_SIZE,
  NECKLACE_MAX,
  NECKLACE_MIN,
  sizeLabel,
  type ProductCategory,
} from "@/lib/product-category";

const SIZE_OPTIONS = [
  { cm: 38, label: "短めの長さ", note: "首元に近い長さ" },
  { cm: 41, label: "やや長めの長さ", note: "少し下に落ちる長さ" },
];

// カスタム長さの範囲(チェックアウトAPI側のバリデーションと合わせる。定義は lib/product-category.ts)
const CUSTOM_MIN = NECKLACE_MIN;
const CUSTOM_MAX = NECKLACE_MAX;
const CUSTOM_SIZES = Array.from(
  { length: CUSTOM_MAX - CUSTOM_MIN + 1 },
  (_, i) => CUSTOM_MIN + i,
);

export function ProductBuy({
  productId,
  category = "necklace",
  disabled,
}: {
  productId: string;
  category?: ProductCategory;
  disabled?: boolean;
}) {
  const [size, setSize] = useState<number>(
    category === "bracelet" ? BRACELET_DEFAULT : 38,
  );
  const [isCustom, setIsCustom] = useState(false);
  const [customSize, setCustomSize] = useState<number>(40);
  const [adding, setAdding] = useState(false);
  const add = useCart((s) => s.add);

  // メガネチェーンは長さ選択なし(カート上の size は 0)
  const effectiveSize =
    category === "glasses-chain" ? NO_SIZE : isCustom ? customSize : size;
  const effectiveLabel = sizeLabel(category, effectiveSize);

  const handleAdd = () => {
    if (disabled) return;
    setAdding(true);
    add(productId, effectiveSize, 1);
    setTimeout(() => setAdding(false), 600);
  };

  return (
    <div>
      {category === "bracelet" && (
        <div>
          <p
            className="font-marker text-[20px] leading-none md:text-[22px]"
            style={{ color: "var(--bead-olive)" }}
          >
            長さを選ぶ
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2.5">
            {BRACELET_SIZES.map((cm) => (
              <button
                key={cm}
                onClick={() => setSize(cm)}
                disabled={disabled}
                aria-pressed={size === cm}
                className={cn(
                  "flex items-center justify-center border px-2 py-3 transition-colors",
                  size === cm
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground/60",
                  disabled && "opacity-50",
                )}
              >
                <span className="font-marker text-[24px] leading-none">
                  {cm}cm
                </span>
              </button>
            ))}
          </div>
          <p className="font-hand mt-3 text-[12px] leading-[1.6] text-muted-foreground">
            手首まわりに少しゆとりを足した長さがおすすめです。迷ったら 17cm。
          </p>
          <Link
            href="/guide/length#bracelet"
            className="font-hand mt-1 inline-flex min-h-11 items-center text-[14px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            長さの選び方 →
          </Link>
        </div>
      )}

      {category === "necklace" && (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p
            className="font-marker text-[20px] leading-none md:text-[22px]"
            style={{ color: "var(--bead-olive)" }}
          >
            長さを選ぶ
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
              好きな長さを指定する
            </span>
            <span className="font-hand text-[13px] leading-tight opacity-75">
              1cm単位・同価格
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
            目安: レディースは首回り +4cm、メンズは首回り +5cm
          </p>
        )}
        <p className="font-hand mt-3 text-[12px] leading-[1.6] text-muted-foreground">
          ネックレスは1cm単位で長さを指定できます。カスタムも同価格です。
          すべてアジャスター付きで、±2cm 程度の調整ができます。
        </p>
      </div>
      )}

      <div className="mt-6">
        {disabled ? (
          <Button size="lg" variant="outline" disabled className="w-full">
            売り切れ
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleAdd}
            disabled={adding}
            className="w-full"
          >
            {adding
              ? "カートに追加しました。"
              : effectiveLabel
                ? `カートに入れる｜${effectiveLabel}`
                : "カートに入れる"}
          </Button>
        )}
      </div>

      <div className="font-hand mt-4 space-y-1 text-[14px] leading-[1.8] text-muted-foreground">
        <p>送料：全国一律 ¥150</p>
        <p>発送：ご注文・ご入金の確認後、通常3〜7営業日以内</p>
        <p>受注制作などで通常よりお時間をいただく場合は、事前にメールでご連絡します。</p>
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <p className="font-hand text-[15px] leading-[1.85] text-foreground/85">
          ひとつずつ手で編んでいるため、ビーズの並びや色合いには少しずつ違いがあります。
        </p>
      </div>

      {category !== "glasses-chain" && (
        <div className="mt-6">
          <p className="font-hand text-[15px] leading-[1.85] text-foreground/85">
            長さの選び方に迷ったら、InstagramのDMでご相談ください。
          </p>
          <a
            href="https://ig.me/m/740nll"
            target="_blank"
            rel="noopener noreferrer"
            className="font-marker mt-2 inline-flex min-h-11 items-center gap-2 text-[18px] underline-offset-4 transition-opacity hover:opacity-75"
            style={{ color: "var(--bead-rust)" }}
          >
            サイズについて相談する →
          </a>
        </div>
      )}

      <div className="mt-6">
        <p className="font-hand text-[15px] leading-[1.85] text-foreground/85">
          お手入れと保管方法はこちらをご確認ください。
        </p>
        <Link
          href="/care"
          className="font-marker mt-2 inline-flex min-h-11 items-center gap-2 text-[18px] underline-offset-4 transition-opacity hover:opacity-75"
          style={{ color: "var(--bead-olive)" }}
        >
          お手入れの方法を見る →
        </Link>
      </div>
    </div>
  );
}
