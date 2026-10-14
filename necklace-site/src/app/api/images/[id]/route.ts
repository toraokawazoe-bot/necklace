import { IMAGE_ID, loadImage } from "@/lib/image-store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!IMAGE_ID.test(id)) return new Response("Not found", { status: 404 });
  const img = await loadImage(id);
  if (!img) return new Response("Not found", { status: 404 });
  // id は内容ごとに新しく振るので、一度配った画像は変わらない
  return new Response(new Uint8Array(img.body), {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
