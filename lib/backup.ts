import { Order, Settings } from "./types";

// 注文と設定をまとめた JSON をローカルにダウンロードする（手動バックアップ）。
// データは Firestore のみに存在し、誤削除や障害で全履歴を失うリスクがあるため、
// いつでも端末に控えを残せるようにする。DM ログ(ig_messages)は対象外（注文の控えが目的）。
// 注意: これは「書き出し」専用。アプリ内に自動復元（取り込み）の経路はまだ無い。
// 戻り値で成否を返し、呼び出し側でユーザーに通知する（特にスマホで失敗が分かりにくい）。
export function exportBackup(orders: Order[], settings: Settings): boolean {
  try {
    const payload = {
      app: "necklace-order-manager",
      version: 1,
      exportedAt: new Date().toISOString(),
      orderCount: orders.length,
      orders,
      settings,
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    a.download = `necklace-orders-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error("[backup] export failed", e);
    return false;
  }
}
