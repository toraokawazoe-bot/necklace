// 2026-10-14: チーム共有の Vercel Blob が無料枠超過で停止し、商品画像が 403 になった。
// 画像最適化キャッシュから取り出した画像を public/products/rescued/ に置き、
// 商品データに残っている旧 Blob の URL を読み込み時にこちらへ差し替える。
// 管理画面で商品を保存し直すと、差し替え後の URL がそのまま保存される。

const LEGACY_BASE = "https://x2x1nesomiaooomq.public.blob.vercel-storage.com/products/";

const RESCUED: Record<string, string> = {
  "1779156255588-xbo31j": "1779156255588-xbo31j.webp",
  "1779156334223-5cfhsl": "1779156334223-5cfhsl.webp",
  "1789100066157-pritry": "1789100066157-pritry.jpg",
  "1789100263039-xx7elb": "1789100263039-xx7elb.jpg",
  "1789100517298-xz25gj": "1789100517298-xz25gj.jpg",
  "1789100650891-dj5dbg": "1789100650891-dj5dbg.jpg",
  "1789100872875-iyus54": "1789100872875-iyus54.jpg",
  "1789100950794-k1d3bb": "1789100950794-k1d3bb.jpg",
  "1789101031034-xqyncy": "1789101031034-xqyncy.jpg",
  "1789101109075-j8thc1": "1789101109075-j8thc1.jpg",
  "1789101142745-vznzop": "1789101142745-vznzop.jpg",
};

export function resolveLegacyImage(url: string): string {
  if (!url.startsWith(LEGACY_BASE)) return url;
  const stem = url.slice(LEGACY_BASE.length).replace(/\.[^.]+$/, "");
  const file = RESCUED[stem];
  return file ? `/products/rescued/${file}` : url;
}
