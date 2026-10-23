// 止まった決済(期限切れ・失敗)を Stripe から読み、段階・理由・端末などを集計して表示する。
// Stripe は読むだけ(list / retrieve)。何も書き込まない。Redis も使わない。
//
// 使い方(読み取り専用の制限付きキー rk_live_... で足りる。権限: Checkout Sessions / PaymentIntents / Charges / Events の読み取り):
//   STRIPE_SECRET_KEY=rk_live_xxx node scripts/analyze-abandoned.mjs [--days 120] [--json out.json]
// キーはシェルの履歴に残さないこと。個人情報(メール)は伏せ字で出す。
import Stripe from "stripe";
import { writeFileSync } from "node:fs";
import {
  buildRecord,
  fetchSessionDetail,
  deriveStage,
  deriveEnd,
  STAGE_LABEL,
  END_LABEL,
  summarize,
  maskEmail,
  methodLabel,
} from "../src/lib/abandoned-core.ts";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY を環境変数で渡してください。");
  process.exit(1);
}
const args = process.argv.slice(2);
const days = Number(args[args.indexOf("--days") + 1]) || 120;
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;

const stripe = new Stripe(key);
const since = Math.floor(Date.now() / 1000) - days * 86400;

// 期限切れイベント(30日分): 閉じた時刻と、API で閉じたか自動かが分かる
const closed = new Map();
try {
  for await (const ev of stripe.events.list({ type: "checkout.session.expired", limit: 100 })) {
    closed.set(ev.data.object.id, { at: ev.created * 1000, byApi: Boolean(ev.request?.id) });
  }
} catch (e) {
  console.error("events 取得失敗(権限不足の可能性):", e.message);
}

const records = [];
let paid = 0;
let open = 0;
for await (const s of stripe.checkout.sessions.list({
  limit: 100,
  created: { gte: since },
  expand: ["data.payment_intent"],
})) {
  if (s.payment_status === "paid") {
    paid++;
    continue;
  }
  if (s.status === "open") {
    open++;
    continue;
  }
  const d = await fetchSessionDetail(stripe, s);
  const ev = closed.get(s.id);
  records.push(
    buildRecord(d, ev ? { endedAt: ev.at, expiredByApi: ev.byApi } : {}),
  );
}

const pct = (n, t) => (t ? `${Math.round((n / t) * 100)}%` : "-");
const sum = summarize(records);
const total = sum.total;
const print = (title, rows) => {
  console.log(`\n■ ${title}`);
  for (const r of rows) console.log(`  ${String(r.count).padStart(3)} (${pct(r.count, total)})  ${r.key}`);
};
console.log(`対象: 過去${days}日 / 決済済 ${paid} / 開きっぱなし ${open} / 止まった決済 ${total}`);
print("どこまで進んだか", sum.byStage);
print("終わり方", sum.byEnd);
print("失敗理由(支払いを試した分、試行ごと)", sum.byReason);
print("支払方法(最後に選んだもの)", sum.byMethod);
print("OS", sum.byDevice);
print("アプリ/ブラウザ(作成時の記録がある分のみ。過去分は不明)", sum.byApp);
print("金額帯", sum.byAmount);
console.log(`\n■ 時間帯(JST, 作成時刻)`);
console.log("  " + sum.byHour.filter((h) => h.count).map((h) => `${h.hour}時:${h.count}`).join("  "));
console.log(`\n■ その他`);
console.log(`  カードのみ(PayPay不可)で作ったセッション: ${sum.cardOnlyCount}`);
console.log(`  クーポンあり: ${sum.withCoupon}`);
console.log(`  支払いを試した(PaymentIntentあり): ${sum.attemptedCount}`);
console.log(`  メールまで入力: ${sum.emailEnteredCount}`);
console.log(`  作成→閉じるまでの分(中央値/90%): ${sum.durationMinutes.median ?? "-"} / ${sum.durationMinutes.p90 ?? "-"}`);
console.log(`  同じ人の繰り返し: ${sum.repeatPeople.map((p) => `${maskEmail(p.email)}×${p.count}`).join(", ") || "なし"}`);

console.log(`\n■ 1件ずつ(新しい順)`);
for (const r of records.sort((a, b) => b.createdAt - a.createdAt)) {
  const t = new Date(r.createdAt + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  const why = r.attempts.filter((a) => !a.ok).map((a) => a.reasonJa).join(" / ");
  console.log(
    `${t} ${r.sessionId.slice(0, 14)}… ¥${r.amount} ${STAGE_LABEL[deriveStage(r)]} | ${END_LABEL[deriveEnd(r)]} | 画面:${r.methodsOffered.map(methodLabel).join("+")} | 方法:${methodLabel(r.payMethod)} | ${maskEmail(r.email)}${why ? " | 理由:" + why : ""}`,
  );
}
if (jsonOut) {
  // メールは伏せ字にして保存(共有しても個人情報が出ないように)
  writeFileSync(jsonOut, JSON.stringify(records.map((r) => ({ ...r, email: maskEmail(r.email) })), null, 2));
  console.log(`\nJSON を ${jsonOut} に保存しました(メールは伏せ字)。`);
}
