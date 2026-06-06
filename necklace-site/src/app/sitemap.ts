import type { MetadataRoute } from "next";
import { listAllProductsWithInventory } from "@/lib/products";

const BASE = "https://www.740nll.store";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await listAllProductsWithInventory().catch(() => []);
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, priority: 1 },
    { url: `${BASE}/products`, lastModified: now, priority: 0.9 },
    { url: `${BASE}/about`, lastModified: now, priority: 0.5 },
    { url: `${BASE}/care`, lastModified: now, priority: 0.4 },
    { url: `${BASE}/legal/tokushoho`, lastModified: now, priority: 0.2 },
    { url: `${BASE}/legal/privacy`, lastModified: now, priority: 0.2 },
  ];

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE}/products/${p.slug}`,
    lastModified: new Date(p.updatedAt * 1000),
    priority: 0.8,
  }));

  return [...staticPages, ...productPages];
}
