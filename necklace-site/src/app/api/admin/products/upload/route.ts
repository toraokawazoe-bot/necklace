import { NextResponse } from "next/server";
import { saveImage } from "@/lib/image-store";
import { getAdminSession } from "@/lib/admin-session";
import { enforce, uploadLimiter } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
// 管理画面が送信前に 2MB 以下へ縮めるので、それより大きいものは弾く
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rl = await enforce(uploadLimiter(), session.email);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Upload rate limit exceeded" },
      { status: 429 },
    );
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form-data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file が必要です" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `画像形式が未対応です: ${file.type}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `画像サイズは ${MAX_BYTES / 1024 / 1024}MB 以下にしてください` },
      { status: 400 },
    );
  }

  try {
    const url = await saveImage(file);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[upload] image save failed:", e);
    return NextResponse.json(
      { error: "アップロードに失敗しました" },
      { status: 500 },
    );
  }
}
