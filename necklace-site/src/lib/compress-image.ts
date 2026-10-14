// 管理画面のアップロード前に画像を縮める。
// Vercel Functions のリクエスト本文は 4.5MB が上限なので、スマホ写真をそのまま送ると 413 になる。
// iPhone の HEIC も、ブラウザが読めるならここで JPEG に変換される。

const MAX_EDGE = 2000;
const TARGET_BYTES = 2 * 1024 * 1024;
const QUALITIES = [0.85, 0.75, 0.65, 0.55];

const PASSTHROUGH_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("この画像は読み込めませんでした（JPEG / PNG / WebP で保存し直してください）"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function compressImage(file: File): Promise<File> {
  // 小さくて対応形式ならそのまま送る（PNG の透過などを壊さない）
  if (PASSTHROUGH_TYPES.has(file.type) && file.size <= TARGET_BYTES) return file;

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // JPEG は透過を持てないので白で下塗りする
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let out: Blob | null = null;
  for (const q of QUALITIES) {
    out = await toBlob(canvas, q);
    if (out && out.size <= TARGET_BYTES) break;
  }
  if (!out) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([out], name, { type: "image/jpeg" });
}
