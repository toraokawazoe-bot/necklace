import { NextResponse } from "next/server";
import { listAllProductsWithInventory } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await listAllProductsWithInventory();
    return NextResponse.json({ products });
  } catch (e) {
    console.error("[api/products] failed:", e);
    return NextResponse.json({ products: [] }, { status: 500 });
  }
}
