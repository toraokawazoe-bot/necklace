import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { seedProducts } from "@/lib/product-seed";
import { createProduct, listProducts, getProduct } from "@/lib/product-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const existing = await listProducts({ includeUnpublished: true });
  const existingIds = new Set(existing.map((p) => p.id));

  const created: string[] = [];
  const skipped: string[] = [];
  let order = existing.length;

  for (const seed of seedProducts) {
    if (existingIds.has(seed.id) || (await getProduct(seed.id))) {
      skipped.push(seed.id);
      continue;
    }
    try {
      await createProduct({ ...seed, sortOrder: order });
      created.push(seed.id);
      order++;
    } catch (e) {
      console.error("[seed] failed for", seed.id, e);
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    total: created.length + skipped.length,
  });
}
