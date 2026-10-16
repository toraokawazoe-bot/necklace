// 昨日追加されたブレスレット4商品の category を "bracelet" に変える(category だけを変える)。
//
// 本番の Upstash Redis を書き換えるので、既定は「確認だけ」(何も書かない)。
//   確認:  node --env-file=.env.local scripts/set-bracelet-category.mjs
//   実行:  node --env-file=.env.local scripts/set-bracelet-category.mjs --apply
//
// 動き:
//   1. slug から商品IDを引き、現在の商品JSONを scripts/backups/ に書き出す(--apply でなくても書く)
//   2. 4つとも見つかった時だけ先へ進む(1つでも無ければ何も書かずに終了)
//   3. --apply の時だけ、category を "bracelet" にして保存(他の項目・更新日時には触れない)
//   4. 保存後に読み直して確認する
// 管理画面で「カテゴリ」を変えて保存する方法でも同じことができる。
import { Redis } from "@upstash/redis";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SLUGS = ["jdtgmtjgwdjtwm", "jagdwjagdwmjagdwmwjagdwmw", "goldgoldh", "ejmumdw"];
const TARGET = "bracelet";
const NS = "740nll:products";
const apply = process.argv.includes("--apply");

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("KV_REST_API_URL / KV_REST_API_TOKEN が見つかりません（--env-file=.env.local を付けてください）");
  process.exit(1);
}
const redis = new Redis({ url, token });

const parse = (raw) => (typeof raw === "string" ? JSON.parse(raw) : raw);

const found = [];
for (const slug of SLUGS) {
  const id = await redis.get(`${NS}:slug:${slug}`);
  if (!id) {
    console.error(`slug が見つかりません: ${slug}。何も書かずに終了します。`);
    process.exit(1);
  }
  const raw = await redis.get(`${NS}:item:${id}`);
  if (!raw) {
    console.error(`商品データが見つかりません: ${slug} (${id})。何も書かずに終了します。`);
    process.exit(1);
  }
  found.push({ slug, id, product: parse(raw) });
}

// バックアップ(変更前の商品JSON)
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "backups");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = join(dir, `products-before-bracelet-${stamp}.json`);
writeFileSync(file, JSON.stringify(found.map((f) => f.product), null, 2));
console.log(`バックアップ: ${file}`);

for (const f of found) {
  console.log(`- ${f.slug} (${f.id}) 「${f.product.name}」 category: ${f.product.category ?? "(未設定)"} -> ${TARGET}`);
}

if (!apply) {
  console.log("\n確認のみです。書き込むには --apply を付けて実行してください。");
  process.exit(0);
}

for (const f of found) {
  const updated = { ...f.product, category: TARGET };
  await redis.set(`${NS}:item:${f.id}`, JSON.stringify(updated));
}

for (const f of found) {
  const after = parse(await redis.get(`${NS}:item:${f.id}`));
  if (after.category !== TARGET) {
    console.error(`確認に失敗: ${f.slug} の category が ${after.category} のままです`);
    process.exit(1);
  }
}
console.log(`\n完了: ${found.length} 商品を ${TARGET} に変更しました。復元が必要ならバックアップJSONを使ってください。`);
