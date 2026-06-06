import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { reorderProducts } from "@/lib/product-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { ids?: unknown };
  try {
    body = (await req.json()) as { ids?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.ids) || body.ids.some((x) => typeof x !== "string")) {
    return NextResponse.json(
      { error: "ids: string[] が必要です" },
      { status: 400 },
    );
  }
  try {
    await reorderProducts(body.ids as string[]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "reorder failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
