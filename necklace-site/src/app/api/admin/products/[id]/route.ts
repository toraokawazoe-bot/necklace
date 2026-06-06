import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from "@/lib/product-store";
import type { Product } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: Partial<Product>;
  try {
    body = (await req.json()) as Partial<Product>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.slug && !/^[a-z0-9-]+$/.test(body.slug)) {
    return NextResponse.json(
      { error: "スラッグは小文字英数字とハイフンのみ使えます" },
      { status: 400 },
    );
  }
  if (body.price !== undefined && (typeof body.price !== "number" || body.price < 0)) {
    return NextResponse.json(
      { error: "価格は0以上の数値で指定してください" },
      { status: 400 },
    );
  }
  try {
    const product = await updateProduct(id, body);
    return NextResponse.json({ product });
  } catch (e) {
    const message = e instanceof Error ? e.message : "update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
