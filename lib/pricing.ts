import { ItemType, Order, Settings } from "./types";

export function monthKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  return `${y}年${Number(m)}月`;
}

export function defaultPrice(
  settings: Settings,
  ts: number,
  type: ItemType
): number | undefined {
  if (!type) return undefined;
  const month = settings.monthlyPrices[monthKey(ts)];
  if (!month) return undefined;
  return type === "ネックレス" ? month.necklace : month.bracelet;
}

export function effectivePrice(
  settings: Settings,
  order: Order
): number | undefined {
  if (typeof order.priceOverride === "number") return order.priceOverride;
  return defaultPrice(settings, order.created, order.type);
}

export function formatYen(amount: number | undefined): string {
  if (amount === undefined || Number.isNaN(amount)) return "—";
  return "¥" + amount.toLocaleString("ja-JP");
}

export interface MonthlySummary {
  monthKey: string;
  bookedCount: number;
  bookedAmount: number;
  paidCount: number;
  paidAmount: number;
}

export function summarizeMonth(
  orders: Order[],
  settings: Settings,
  key: string
): MonthlySummary {
  let bookedCount = 0;
  let bookedAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;
  for (const o of orders) {
    if (o.status === "失注") continue;
    const price = effectivePrice(settings, o) ?? 0;
    if (monthKey(o.created) === key) {
      bookedCount += 1;
      bookedAmount += price;
    }
    if (o.status === "完了") {
      const paidTs = o.completedAt ?? o.created;
      if (monthKey(paidTs) === key) {
        paidCount += 1;
        paidAmount += price;
      }
    }
  }
  return { monthKey: key, bookedCount, bookedAmount, paidCount, paidAmount };
}

const DAY_MS = 86_400_000;

// 完了したオーダーから、受注→着金までの平均日数を計算
export function averagePaidDays(orders: Order[]): number | null {
  const diffs: number[] = [];
  for (const o of orders) {
    if (o.status !== "完了") continue;
    if (!o.completedAt || !o.created) continue;
    const diff = (o.completedAt - o.created) / DAY_MS;
    if (diff >= 0) diffs.push(diff);
  }
  if (diffs.length === 0) return null;
  const sum = diffs.reduce((a, b) => a + b, 0);
  return sum / diffs.length;
}

// オーダー単位のリマインド判定。完了/失注は対象外
export function isOverdue(order: Order, avgDays: number | null): boolean {
  if (avgDays === null) return false;
  if (order.status === "完了" || order.status === "失注") return false;
  const elapsed = (Date.now() - order.created) / DAY_MS;
  return elapsed > avgDays;
}

export function elapsedDays(order: Order): number {
  return Math.floor((Date.now() - order.created) / DAY_MS);
}
