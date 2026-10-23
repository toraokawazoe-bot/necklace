import sharp from "sharp";

// 商品写真から位置情報(GPS)・撮影日時・機種などのメタデータを取り除く。
// iPhone の写真は EXIF に撮影場所が入っているので、公開する前に必ずここを通す。
//
// - .rotate() は EXIF の向きを画素に反映する(その後 Orientation タグは出力されない)。
//   これをやらずに EXIF だけ消すと写真が横倒しになる。
// - sharp は既定でメタデータを出力しない。色味が変わらないよう ICC プロファイルだけ残す
//   (ICC は撮影場所などの個人情報を含まない)。
// - 失敗したら例外を投げる。GPS 付きの元画像をそのまま返すフォールバックは作らない。
export async function stripImageMetadata(
  input: Buffer,
  type: string,
): Promise<Buffer> {
  const img = sharp(input, { failOn: "error" }).rotate().keepIccProfile();
  switch (type) {
    case "image/jpeg":
      return img.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    case "image/png":
      return img.png().toBuffer();
    case "image/webp":
      return img.webp({ quality: 90 }).toBuffer();
    case "image/avif":
      return img.avif({ quality: 80 }).toBuffer();
    default:
      throw new Error(`unsupported image type: ${type}`);
  }
}
