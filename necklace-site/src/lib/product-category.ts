// 商品カテゴリごとの「長さ」ルール。クライアント(商品ページ・カート)とサーバー(チェックアウトAPI)の両方で使う。
// DB(Redis)を触らないので、ブラウザ側のコードからも import してよい。

export type ProductCategory = "necklace" | "bracelet" | "glasses-chain";

export const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: "necklace", label: "ネックレス" },
  { value: "bracelet", label: "ブレスレット" },
  { value: "glasses-chain", label: "メガネチェーン" },
];

// 未設定・不明な値は necklace 扱い(カテゴリを持たない既存商品との互換)
export function resolveCategory(raw: unknown): ProductCategory {
  return raw === "bracelet" || raw === "glasses-chain" ? raw : "necklace";
}

// ネックレス: 1cm単位のカスタム長さ(商品ページのUIと合わせる)
export const NECKLACE_MIN = 33;
export const NECKLACE_MAX = 50;
// ブレスレット: 16〜19cm の1cm刻み
export const BRACELET_SIZES = [16, 17, 18, 19] as const;
export const BRACELET_DEFAULT = 17;
// メガネチェーンは長さ選択なし。カート上の size は 0 で持つ。
export const NO_SIZE = 0;

export function hasLengthChoice(category: ProductCategory): boolean {
  return category !== "glasses-chain";
}

export function isValidSize(category: ProductCategory, size: unknown): size is number {
  if (typeof size !== "number" || !Number.isInteger(size)) return false;
  switch (category) {
    case "bracelet":
      return (BRACELET_SIZES as readonly number[]).includes(size);
    case "glasses-chain":
      return size === NO_SIZE;
    default:
      return size >= NECKLACE_MIN && size <= NECKLACE_MAX;
  }
}

// 画面表示用(カート等)。長さ選択がないカテゴリは null。
export function sizeLabel(category: ProductCategory, size: number): string | null {
  return hasLengthChoice(category) ? `${size}cm` : null;
}

// Stripeの商品名に付ける「 ・ 38cm」部分。管理画面の注文表示は `\d{2}cm` を拾う。
export function sizeNameSuffix(category: ProductCategory, size: number): string {
  return hasLengthChoice(category) ? ` ・ ${size}cm` : "";
}

// Stripeの商品説明(決済ページ・注文メールの元)。アジャスター文言はネックレスだけ。
export function sizeDescription(category: ProductCategory, size: number): string {
  switch (category) {
    case "necklace":
      return `長さ ${size}cm（アジャスター ±2cm）`;
    case "bracelet":
      return `長さ ${size}cm`;
    default:
      return "";
  }
}

// 空・null・undefined=無制限(null)。0以上の整数ならその数。それ以外は invalid。
export function parseStock(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n >= 0 ? n : "invalid";
}
