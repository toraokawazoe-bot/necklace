import { IMAGE_ID, loadImage } from "@/lib/image-store";
import { stripImageMetadata } from "@/lib/image-sanitize";

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
  // 保存済みの古い画像には GPS 付きの EXIF が残っていることがあるので、配信のたびに外す。
  // 失敗した場合は元画像を返さず 500 にする。
  let body: Buffer;
  try {
    body = await stripImageMetadata(img.body, img.type);
  } catch (e) {
    console.error(`[images] metadata strip failed for ${id}:`, e);
    return new Response("Image processing failed", { status: 500 });
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
