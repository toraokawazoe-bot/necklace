import { cache } from "react";
import * as store from "./product-store";
import { getSoldOutIds } from "./inventory";

export type { ProductCategory } from "./product-category";
import type { ProductCategory } from "./product-category";

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
  gallery: string[];
  details: string[];
  inStock: boolean;
  // 残り在庫数。未設定(undefined/null)=無制限。実体は Redis の在庫カウンタ(inventory.ts)
  stock?: number | null;
  published: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

// 購入できる状態か(公開中・在庫フラグ・在庫数)
export function isAvailable(p: Pick<Product, "inStock" | "published" | "stock">): boolean {
  if (p.published === false) return false;
  if (!p.inStock) return false;
  return p.stock == null || p.stock > 0;
}

export const listAllProducts = cache(async (): Promise<Product[]> => {
  return store.listProducts({ includeUnpublished: false });
});

export const listAllProductsWithInventory = cache(async (): Promise<Product[]> => {
  const [products, soldOut] = await Promise.all([
    store.listProducts({ includeUnpublished: false }),
    getSoldOutIds(),
  ]);
  return products.map((p) => ({
    ...p,
    inStock: isAvailable(p) && !soldOut.has(p.id),
  }));
});

export async function getProductById(id: string): Promise<Product | null> {
  return store.getProduct(id);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return store.getProductBySlug(slug);
}

export async function getProductBySlugWithInventory(
  slug: string,
): Promise<Product | null> {
  const product = await store.getProductBySlug(slug);
  if (!product) return null;
  const soldOut = await getSoldOutIds();
  return { ...product, inStock: isAvailable(product) && !soldOut.has(product.id) };
}

export async function getAllSlugs(): Promise<string[]> {
  return store.getAllSlugs();
}
