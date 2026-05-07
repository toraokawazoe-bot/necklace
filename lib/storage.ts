import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { Order } from "./types";

const ORDERS_COL = "orders";

export function subscribeOrders(onData: (orders: Order[]) => void): () => void {
  return onSnapshot(collection(db, ORDERS_COL), (snapshot) => {
    const orders = snapshot.docs.map((d) => d.data() as Order);
    onData(orders);
  });
}

export async function saveOrder(order: Order): Promise<void> {
  await setDoc(doc(db, ORDERS_COL, order.id), order);
}

export async function deleteOrder(id: string): Promise<void> {
  await deleteDoc(doc(db, ORDERS_COL, id));
}

// 未登録のシードオーダーだけを追加（常にマージ）
export async function mergeSeedOrders(seedOrders: Order[]): Promise<void> {
  const snapshot = await getDocs(collection(db, ORDERS_COL));
  const existingIds = new Set(snapshot.docs.map((d) => d.id));
  const missing = seedOrders.filter((o) => !existingIds.has(o.id));
  if (missing.length === 0) return;
  const batch = writeBatch(db);
  for (const order of missing) {
    batch.set(doc(db, ORDERS_COL, order.id), order);
  }
  await batch.commit();
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
