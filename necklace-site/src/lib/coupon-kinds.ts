// クーポンの種類と割引の計算。Redis・Stripe を触らないので、ブラウザ側のコードからも import してよい。
// 割引率はここだけで持つ。どの種類も 1 回限り・期限なし・送料は割引しない。
import type { ProductCategory } from "./product-category";

export type CouponKind = "general30" | "necklace10" | "bracelet30";

export type CouponKindConfig = {
  percentOff: number;
  // 割引の対象カテゴリ。null=全商品。
  categories: ProductCategory[] | null;
  // 管理画面の一覧に出す名前
  label: string;
  // 対象外のカートで使おうとした時の案内
  onlyFor: string | null;
};

export const COUPON_KINDS: Record<CouponKind, CouponKindConfig> = {
  general30: {
    percentOff: 30,
    categories: null,
    label: "管理画面（全商品30%）",
    onlyFor: null,
  },
  necklace10: {
    percentOff: 10,
    categories: ["necklace"],
    label: "LINE（ネックレス10%）",
    onlyFor: "ネックレス",
  },
  bracelet30: {
    percentOff: 30,
    categories: ["bracelet"],
    label: "ネックレス購入特典（ブレスレット30%）",
    onlyFor: "ブレスレット",
  },
};

export const NECKLACE10_PERCENT = COUPON_KINDS.necklace10.percentOff;
export const BRACELET30_PERCENT = COUPON_KINDS.bracelet30.percentOff;
export const GENERAL30_PERCENT = COUPON_KINDS.general30.percentOff;

export function isCouponKind(v: unknown): v is CouponKind {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(COUPON_KINDS, v);
}

export type DiscountLine = {
  category: ProductCategory;
  // 商品代(単価 × 数量)。送料は含めない。
  amount: number;
};

// 割引額(円)。対象カテゴリの商品代にだけ割引率をかけ、円未満は切り捨てる。
// 対象の商品がカートに無ければ eligible=0 を返す(呼び出し側で案内を出す)。
export function calcDiscount(
  kind: CouponKind,
  lines: DiscountLine[],
): { eligibleSubtotal: number; discount: number } {
  const cfg = COUPON_KINDS[kind];
  const eligibleSubtotal = lines
    .filter((l) => cfg.categories === null || cfg.categories.includes(l.category))
    .reduce((sum, l) => sum + l.amount, 0);
  const discount = Math.floor((eligibleSubtotal * cfg.percentOff) / 100);
  return { eligibleSubtotal, discount };
}

// 入力欄の表記ゆれ(全角・小文字・前後の空白)をそろえる。
export function normalizeCouponCode(raw: string): string {
  return raw.normalize("NFKC").trim().toUpperCase().replace(/[\s‐-―−]+/g, "-");
}

export const COUPON_CODE_PATTERN = /^740-[A-Z2-9]{6}$/;
