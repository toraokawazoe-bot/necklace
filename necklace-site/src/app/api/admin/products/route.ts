import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import {
  createProduct,
  listProducts,
  type ProductInput,
} from "@/lib/product-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const products = await listProducts({ includeUnpublished: true });
  return NextResponse.json({ products });
}

type CreateBody = Partial<ProductInput>;

function validate(body: CreateBody): { ok: true; input: ProductInput } | { ok: false; error: string } {
  const required: (keyof ProductInput)[] = [
    "slug",
    "name",
    "subtitle",
    "description",
    "price",
    "material",
    "length",
    "image",
    "imageAlt",
    "imageBg",
  ];
  for (const key of required) {
    const v = body[key];
    if (v === undefined || v === null || v === "") {
      return { ok: false, error: `${String(key)} は必須です` };
    }
  }
  if (typeof body.price !== "number" || body.price < 0) {
    return { ok: false, error: "価格は0以上の数値で指定してください" };
  }
  if (!/^[a-z0-9-]+$/.test(String(body.slug))) {
    return {
      ok: false,
      error: "スラッグは小文字英数字とハイフンのみ使えます",
    };
  }
  const input: ProductInput = {
    id: body.id ?? "",
    slug: String(body.slug),
    name: String(body.name),
    subtitle: String(body.subtitle),
    description: String(body.description),
    price: Number(body.price),
    currency: "JPY",
    category: "necklace",
    material: String(body.material),
    length: String(body.length),
    image: String(body.image),
    imageAlt: String(body.imageAlt),
    imageBg: String(body.imageBg),
    details: Array.isArray(body.details) ? body.details.map(String) : [],
    gallery: Array.isArray(body.gallery) ? body.gallery.map(String) : [],
    inStock: body.inStock !== false,
    published: body.published !== false,
    sortOrder: body.sortOrder,
  };
  return { ok: true, input };
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = validate(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  try {
    const product = await createProduct(result.input);
    return NextResponse.json({ product });
  } catch (e) {
    const message = e instanceof Error ? e.message : "create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
