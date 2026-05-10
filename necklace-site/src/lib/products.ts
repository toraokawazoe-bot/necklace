export type ProductCategory = "necklace";

export type Product = {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  currency: "JPY";
  category: ProductCategory;
  material: string;
  length: string;
  image: string;
  imageAlt: string;
  imageBg: string;
  details: string[];
  inStock: boolean;
};

const BG = "#efe4cd";
const PRICE = 2500;

const baseDetails = [
  "ガラスビーズ／ ナイロンコード編み",
  "全長 約 38–42cm（個体差あり）",
  "一点ずつ手編み・色合いやビーズの並びには微妙な個体差があります",
];

export const products: Product[] = [
  {
    id: "p_clear_red",
    slug: "clear-red",
    name: "クリア × レッド",
    subtitle: "Clear & red beaded necklace",
    description:
      "透明のシードビーズに、ところどころ赤の差し色を効かせた一本。光に当たるとクリアビーズがきらりと光ります。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "クリアガラスビーズ／ レッドガラスビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/clear-red.jpg",
    imageAlt: "クリア × レッド ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_yellow_white",
    slug: "yellow-white",
    name: "イエロー × ホワイト",
    subtitle: "Yellow & white beaded necklace",
    description:
      "鮮やかな黄色とミルキーホワイトを交互に編んだ、夏の T シャツに映えるネックレス。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "ガラスビーズ（黄・白）／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/yellow-white.jpg",
    imageAlt: "イエロー × ホワイト ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_red",
    slug: "red",
    name: "レッド",
    subtitle: "Solid red beaded necklace",
    description:
      "鮮やかな赤一色で編んだシンプルなネックレス。差し色として日常に取り入れやすい一本。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "レッドガラスビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/red.jpg",
    imageAlt: "レッド ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_black_gold",
    slug: "black-gold",
    name: "ブラック × ゴールド",
    subtitle: "Black & gold beaded necklace",
    description:
      "黒のビーズに小さなゴールドのアクセント。シックに引き締まる一本。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "ブラックガラスビーズ／ ゴールドメタルビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/black-gold.jpg",
    imageAlt: "ブラック × ゴールド ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_navy_red",
    slug: "navy-red",
    name: "ネイビー × レッド",
    subtitle: "Navy & red beaded necklace",
    description:
      "深いネイビーに、ぽつぽつと赤の差し色。アメカジ・古着合わせに。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "ネイビーガラスビーズ／ レッドガラスビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/navy-red.jpg",
    imageAlt: "ネイビー × レッド ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_burgundy_gold",
    slug: "burgundy-gold",
    name: "バーガンディ × ゴールド",
    subtitle: "Burgundy & gold beaded necklace",
    description:
      "深い赤紫（バーガンディ）にゴールドのアクセント。秋冬のニットにも馴染む配色。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "バーガンディガラスビーズ／ ゴールドメタルビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/burgundy-gold.jpg",
    imageAlt: "バーガンディ × ゴールド ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_blue_yellow",
    slug: "blue-yellow",
    name: "ブルー × イエロー",
    subtitle: "Royal blue & yellow beaded necklace",
    description:
      "ロイヤルブルーに鮮やかなイエローを散らした、元気の出る一本。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "ロイヤルブルーガラスビーズ／ イエローガラスビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/blue-yellow.jpg",
    imageAlt: "ブルー × イエロー ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_red_silver",
    slug: "red-silver",
    name: "レッド × シルバー",
    subtitle: "Red & silver beaded necklace",
    description:
      "深い赤の中に、シルバーのスパイスをひと振り。クールにまとまる組み合わせ。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "レッドガラスビーズ／ シルバーメタルビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/red-silver.jpg",
    imageAlt: "レッド × シルバー ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_brown",
    slug: "brown",
    name: "ブラウン",
    subtitle: "Brown beaded necklace",
    description:
      "落ち着いたブラウン一色。シンプルで、毎日の服に静かに馴染みます。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "ブラウンガラスビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/brown.jpg",
    imageAlt: "ブラウン ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
  {
    id: "p_silver_orange",
    slug: "silver-orange",
    name: "シルバー × オレンジ",
    subtitle: "Silver & orange beaded necklace",
    description:
      "クールなシルバーに、ぽんとオレンジ。ヴィンテージ T との相性が良い一本。",
    price: PRICE,
    currency: "JPY",
    category: "necklace",
    material: "シルバーメタルビーズ／ オレンジガラスビーズ／ ナイロンコード",
    length: "約 38–42cm",
    image: "/products/silver-orange.jpg",
    imageAlt: "シルバー × オレンジ ビーズネックレス",
    imageBg: BG,
    details: baseDetails,
    inStock: true,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getAllSlugs() {
  return products.map((p) => p.slug);
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

import { getSoldOutIds } from "./inventory";

export async function getProductsWithInventory(): Promise<Product[]> {
  const soldOut = await getSoldOutIds();
  return products.map((p) => ({
    ...p,
    inStock: p.inStock && !soldOut.has(p.id),
  }));
}

export async function getProductBySlugWithInventory(
  slug: string,
): Promise<Product | undefined> {
  const product = products.find((p) => p.slug === slug);
  if (!product) return undefined;
  const soldOut = await getSoldOutIds();
  return { ...product, inStock: product.inStock && !soldOut.has(product.id) };
}
