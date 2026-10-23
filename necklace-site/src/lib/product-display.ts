// 商品の「表示用」の名前・英語補助ラベル・画像の代替テキスト。
// データ(管理画面)側に英語の識別名(例「clear×red」)が残っていても、
// 画面には「クリア × レッド」の形式で出すための変換。日本語の名前はそのまま通す。
import type { ProductCategory } from "./product-category";

const COLOR_JA: Record<string, string> = {
  clear: "クリア",
  red: "レッド",
  yellow: "イエロー",
  white: "ホワイト",
  blue: "ブルー",
  green: "グリーン",
  "yellow green": "イエローグリーン",
  "yellow grenn": "イエローグリーン", // 識別名の綴りゆれ
  "light green": "ライトグリーン",
  "emerald green": "エメラルドグリーン",
  "turquoise blue": "ターコイズブルー",
  turquoise: "ターコイズブルー",
  brown: "ブラウン",
  gold: "ゴールド",
  silver: "シルバー",
  black: "ブラック",
  orange: "オレンジ",
  pink: "ピンク",
  navy: "ネイビー",
  burgundy: "バーガンディ",
  star: "スター",
};

const KIND_WORDS = /\b(necklace|bracelet|chain|glasses)\b/gi;

function hasAscii(s: string): boolean {
  return /[A-Za-z]/.test(s);
}

// 「clear×red」「black×silver×star bracelet」→ 色名の配列。変換できなければ null。
function parseTokens(raw: string): string[] | null {
  const cleaned = raw
    .replace(KIND_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned
    .split(/\s*[×xX&]\s*/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.every((t) => t in COLOR_JA) ? tokens : null;
}

/** 画面に出す商品名。「クリア × レッド」の形式に揃える。 */
export function displayName(name: string): string {
  if (!hasAscii(name)) return name.replace(/\s*[×x]\s*/g, " × ");
  const tokens = parseTokens(name);
  if (!tokens) return name;
  return tokens.map((t) => COLOR_JA[t]).join(" × ");
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** 英語の補助ラベル。「Clear × Red」の形式。変換できない時は元の文字列。 */
export function displaySubtitle(name: string, subtitle: string): string {
  const source = hasAscii(subtitle) ? subtitle : name;
  const tokens = parseTokens(source);
  if (!tokens) return subtitle;
  return tokens.map(titleCase).join(" × ");
}

const KIND_LABEL: Record<ProductCategory, string> = {
  necklace: "ビーズネックレス",
  bracelet: "ビーズブレスレット",
  "glasses-chain": "ビーズメガネチェーン",
};

export function kindLabel(category: ProductCategory): string {
  return KIND_LABEL[category];
}

/** 画像の代替テキスト。「クリア × レッドのビーズネックレス」。 */
export function imageAlt(
  name: string,
  category: ProductCategory,
  suffix?: string,
): string {
  return `${displayName(name)}の${KIND_LABEL[category]}${suffix ?? ""}`;
}
