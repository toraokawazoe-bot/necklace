import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { EMPTY_SETTINGS, IgMessageDoc, Order, Settings } from "./types";
import {
  ORDERS as ORDERS_COL,
  IG_MESSAGES as IG_MESSAGES_COL,
  SETTINGS as SETTINGS_COL,
  META as META_COL,
  SETTINGS_DOC,
  SEED_META_DOC,
} from "./collections";

const LEGACY_LS_KEY = "necklace_orders_v1";
const LEGACY_LS_MIGRATED_FLAG = "necklace_orders_v1_migrated";

export function subscribeOrders(
  onData: (orders: Order[]) => void,
  onError?: (err: unknown) => void
): () => void {
  return onSnapshot(
    collection(db, ORDERS_COL),
    (snapshot) => {
      const orders = snapshot.docs.map((d) => d.data() as Order);
      onData(orders);
    },
    (err) => {
      // 権限エラー等で購読が止まったとき、無言で固まらないようログに残し、
      // 呼び出し側にも通知してローディング状態を確定できるようにする。
      console.error("[subscribeOrders] snapshot error", err);
      onError?.(err);
    }
  );
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

// シード（＝初期の実受注データ）は「一度だけ」投入する。毎回マージすると、
// ユーザーが不要なカードを削除しても次回ロードで復活してしまうため、
// meta/seed の imported フラグで一度きりに制限し、以後は削除・編集を定着させる。
export async function mergeSeedOrdersOnce(seedOrders: Order[]): Promise<void> {
  const flagRef = doc(db, META_COL, SEED_META_DOC);
  const flagSnap = await getDoc(flagRef);
  if (flagSnap.exists() && (flagSnap.data() as { imported?: boolean }).imported) {
    return;
  }
  await mergeSeedOrders(seedOrders);
  await setDoc(flagRef, { imported: true, at: Date.now() });
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

// 1 つの DM スレッド（= 送信者）の受信メッセージを時系列で購読する。
// where + orderBy の複合インデックスを避けるため、並べ替えはクライアント側で行う。
export function subscribeThreadMessages(
  threadId: string,
  onData: (messages: IgMessageDoc[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(
    collection(db, IG_MESSAGES_COL),
    where("threadId", "==", threadId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((d) => d.data() as IgMessageDoc);
      messages.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
      onData(messages);
    },
    (err) => {
      // エラーを通知して呼び出し側でローディングを解除できるようにする。
      // ここで onData([]) を呼ぶと表示済みの会話ログを空に巻き戻してしまうため、
      // 既存メッセージはそのまま残し、ローディング状態の確定は呼び出し側に任せる。
      console.error("[subscribeThreadMessages] snapshot error", err);
      onError?.(err);
    }
  );
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

// DM 会話ログ用：月日と時刻まで表示する（例：6/18 14:05）
export function formatDateTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
