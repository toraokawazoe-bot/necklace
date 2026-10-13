// Firestoreの1MBドキュメント制限に収まるよう、画像を縮小・圧縮してbase64化する
const MAX_DIMENSION = 1080;
const QUALITY = 0.72;

export async function compressImage(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", QUALITY);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像を読み込めませんでした"));
    img.src = src;
  });
}

// 「写真から提案」(AI)に送る用。長辺1024px以下の JPEG に縮小し、1枚あたり約1MB以下に収める。
// Firestore には保存しない(画面の表示と送信にだけ使い、終わったら捨てる)。
const AI_MAX_DIMENSION = 1024;
const AI_MAX_B64 = 1_300_000;

export async function resizeForAi(file: File): Promise<{ dataUrl: string; base64: string }> {
  const src = await readFileAsDataUrl(file);
  const img = await loadImage(src);
  const scale = Math.min(1, AI_MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  let dataUrl = "";
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    dataUrl = canvas.toDataURL("image/jpeg", q);
    if (dataUrl.length - dataUrl.indexOf(",") - 1 <= AI_MAX_B64) break;
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (!dataUrl.startsWith("data:image/jpeg") || base64.length > AI_MAX_B64) throw new Error("画像を小さくできませんでした");
  return { dataUrl, base64 };
}
