import { cache } from "react";
import * as store from "./product-store";
import { getSoldOutIds } from "./inventory";

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
  gallery: string[];
  details: string[];
  inStock: boolean;
  published: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

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
    inStock: p.inStock && !soldOut.has(p.id),
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
  return { ...product, inStock: product.inStock && !soldOut.has(product.id) };
}

export async function getAllSlugs(): Promise<string[]> {
  return store.getAllSlugs();
}
