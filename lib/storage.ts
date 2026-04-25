import { Order } from "./types";

const STORAGE_KEY = "necklace_orders_v1";

export async function loadOrders(): Promise<Order[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

export async function saveOrders(orders: Order[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error("保存エラー", e);
  }
}

export function createEmptyOrder(): Order {
  const now = Date.now();
  return {
    id: "o_" + now,
    created: now,
    customer: "",
    type: "",
    length: "",
    design: "",
    payment: "",
    status: "受信トレイ",
    memo: "",
  };
}

export function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
