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
import { EMPTY_SETTINGS, Order, Settings } from "./types";

const ORDERS_COL = "orders";
const SETTINGS_COL = "settings";
const SETTINGS_DOC = "main";
const LEGACY_LS_KEY = "necklace_orders_v1";
const LEGACY_LS_MIGRATED_FLAG = "necklace_orders_v1_migrated";

export function subscribeOrders(onData: (orders: Order[]) => void): () => void {
  return onSnapshot(collection(db, ORDERS_COL), (snapshot) => {
    const orders = snapshot.docs.map((d) => d.data() as Order);
    onData(orders);
  });
}

export async function saveOrder(order: Order): Promise<void> {
  const next: Order = { ...order };
  if (next.status === "完了") {
    if (!next.completedAt) next.completedAt = Date.now();
  } else {
    delete next.completedAt;
  }
  if (next.priceOverride === undefined || Number.isNaN(next.priceOverride)) {
    delete next.priceOverride;
  }
  if (!next.screenshot) delete next.screenshot;
  await setDoc(doc(db, ORDERS_COL, next.id), next);
}

export async function deleteOrder(id: string): Promise<void> {
  await deleteDoc(doc(db, ORDERS_COL, id));
}

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

export async function migrateLegacyLocalOrders(): Promise<number> {
  if (typeof window === "undefined") return 0;
  let raw: string | null = null;
  try {
    if (localStorage.getItem(LEGACY_LS_MIGRATED_FLAG) === "1") return 0;
    raw = localStorage.getItem(LEGACY_LS_KEY);
  } catch {
    return 0;
  }
  if (!raw) {
    try { localStorage.setItem(LEGACY_LS_MIGRATED_FLAG, "1"); } catch {}
    return 0;
  }
  let parsed: Order[];
  try {
    parsed = JSON.parse(raw) as Order[];
  } catch {
    return 0;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    try { localStorage.setItem(LEGACY_LS_MIGRATED_FLAG, "1"); } catch {}
    return 0;
  }
  const snapshot = await getDocs(collection(db, ORDERS_COL));
  const existingIds = new Set(snapshot.docs.map((d) => d.id));
  const missing = parsed.filter((o) => o && o.id && !existingIds.has(o.id));
  if (missing.length === 0) {
    try { localStorage.setItem(LEGACY_LS_MIGRATED_FLAG, "1"); } catch {}
    return 0;
  }
  const batch = writeBatch(db);
  for (const order of missing) {
    const clean: Order = { ...order };
    if (clean.priceOverride === undefined || Number.isNaN(clean.priceOverride)) {
      delete clean.priceOverride;
    }
    if (!clean.screenshot) delete clean.screenshot;
    if (!clean.completedAt) delete clean.completedAt;
    batch.set(doc(db, ORDERS_COL, clean.id), clean);
  }
  await batch.commit();
  try { localStorage.setItem(LEGACY_LS_MIGRATED_FLAG, "1"); } catch {}
  return missing.length;
}

export function subscribeSettings(
  onData: (settings: Settings) => void
): () => void {
  return onSnapshot(doc(db, SETTINGS_COL, SETTINGS_DOC), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as Partial<Settings>;
      onData({
        monthlyPrices: data.monthlyPrices ?? {},
      });
    } else {
      onData(EMPTY_SETTINGS);
    }
  });
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setDoc(doc(db, SETTINGS_COL, SETTINGS_DOC), settings);
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
