import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  getDocs,
  writeBatch,
  runTransaction,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { ADVANCE_FLOW, EMPTY_SETTINGS, IgMessageDoc, Order, OrderStatus, Settings } from "./types";
import {
  ORDERS as ORDERS_COL,
  IG_MESSAGES as IG_MESSAGES_COL,
  SETTINGS as SETTINGS_COL,
  META as META_COL,
  SETTINGS_DOC,
  SEED_META_DOC,
  ORDER_SEQ_DOC,
  STATUS_MIGRATION_DOC,
} from "./collections";

const LEGACY_LS_KEY = "necklace_orders_v1";
const LEGACY_LS_MIGRATED_FLAG = "necklace_orders_v1_migrated";

const PAID_INDEX = ADVANCE_FLOW.indexOf("受注確定");
const DELIVERED_INDEX = ADVANCE_FLOW.indexOf("納品");

// マイルストーン系タイムスタンプ（paidAt/deliveredAt）の自動スタンプ。
// ADVANCE_FLOW上でそのマイルストーン以降に留まる限り保持し、手前に戻されたら消す。
// 失注（ADVANCE_FLOW外）はどちらの分岐にも触れず、既存の値をそのまま残す
// （入金済みで失注した記録を消さないため）。
function stampMilestone(
  next: Order,
  key: "paidAt" | "deliveredAt",
  milestoneIndex: number
): void {
  const statusIndex = ADVANCE_FLOW.indexOf(next.status);
  if (statusIndex === -1) return;
  if (statusIndex >= milestoneIndex) {
    if (!next[key]) next[key] = Date.now();
  } else {
    delete next[key];
  }
}

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
  stampMilestone(next, "paidAt", PAID_INDEX);
  stampMilestone(next, "deliveredAt", DELIVERED_INDEX);
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

// 受注通し番号をカウンタ doc から原子的に 1 個確保する（手動追加用）。
// トランザクションで読んで +1 するので、IG自動生成と同時でも番号が衝突しない。
// カウンタ doc を作るのは backfillOrderNos だけ、という不変条件を守るため、
// 未初期化／next が壊れている場合はここでは作らず undefined を返す（番号は次回
// ロードの backfill が受注順に拾う）。ここで作ると採番順が受注順とズレるため。
export async function allocateOrderNo(): Promise<number | undefined> {
  const ref = doc(db, META_COL, ORDER_SEQ_DOC);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return undefined;
    const raw = snap.data().next;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
    tx.set(ref, { next: raw + 1 }, { merge: true });
    return raw;
  });
}

// 通し番号の採番。番号が無い注文（orderNo == null）を受注順＝created 昇順で拾い、
// カウンタ doc から連番を振る。初回は全件、以後は取りこぼし分だけを埋める
// （冪等・自己修復＝ワンショットにしない）。カウンタ doc を生成・更新するのは
// この関数だけ。subscribe より前に await して呼ぶので、UI 操作（手動採番）が
// 走る時点では必ず初期化済みになる。
export async function backfillOrderNos(): Promise<void> {
  const seqRef = doc(db, META_COL, ORDER_SEQ_DOC);
  const [snapshot, seqSnap] = await Promise.all([
    getDocs(collection(db, ORDERS_COL)),
    getDoc(seqRef),
  ]);
  const all = snapshot.docs
    .map((d) => d.data() as Order)
    .sort((a, b) => a.created - b.created);
  const missing = all.filter((o) => o.orderNo == null);
  const rawNext = seqSnap.exists() ? seqSnap.data().next : undefined;
  const storedNext =
    typeof rawNext === "number" && Number.isFinite(rawNext) ? rawNext : null;
  const maxNo = all.reduce((m, o) => Math.max(m, o.orderNo ?? 0), 0);

  if (missing.length === 0) {
    // 採番対象なし。カウンタが未初期化／壊れ／巻き戻っていれば次の採番に備えて整える。
    if (storedNext == null || storedNext <= maxNo) {
      await setDoc(seqRef, { next: maxNo + 1 });
    }
    return;
  }

  // 連番の開始値。既存番号やカウンタと衝突しないよう max を取る（初回は 1 から）。
  const start = Math.max(storedNext ?? 1, maxNo + 1);
  // Firestore のバッチ上限（500 オペ）を超えないよう分割コミットする。
  const CHUNK = 400;
  for (let i = 0; i < missing.length; i += CHUNK) {
    const batch = writeBatch(db);
    missing.slice(i, i + CHUNK).forEach((o, j) => {
      batch.update(doc(db, ORDERS_COL, o.id), { orderNo: start + i + j });
    });
    await batch.commit();
  }
  // カウンタは全採番をコミットし終えてから進める。途中で落ちても次回ロードで
  // 残りの null を続きから埋め直せる（start を maxNo+1 から再計算するため）。
  await setDoc(seqRef, { next: start + missing.length });
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
    // ここに入ってくる旧データは、新Order型が持たない旧フィールド（completedAt）や
    // 旧ステータス文字列を含んでいる可能性がある。書き込み後は migrateStatusesOnce が
    // 同じロード内で拾って新スキーマへ揃えるため、ここでは undefined 除去のみ行う。
    const clean = { ...order } as Order & { completedAt?: number };
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
    adjuster: "",
    design: "",
    payment: "",
    status: "問い合わせ中",
    memo: "",
    needsResponse: true,
  };
}

// 旧7ステータス（受信トレイ/問い合わせ中/制作中/支払い待ち/発送待ち/完了/失注）から
// 新6段階+失注への一度きりの移行。backfillOrderNos/mergeSeedOrdersOnce と同じ
// 「meta フラグdocで一度だけ実行」パターン。位置ベースのマッピングで、旧「支払い待ち」
// 「発送待ち」は入金済みかどうかのデータが無いため paidAt を推測で作らない。
type LegacyStatus = "受信トレイ" | "問い合わせ中" | "制作中" | "支払い待ち" | "発送待ち" | "完了" | "失注";

function mapLegacyStatus(legacy: LegacyStatus, hasShippedAt: boolean): OrderStatus {
  switch (legacy) {
    case "受信トレイ":
    case "問い合わせ中":
      return "問い合わせ中";
    case "制作中":
      return "制作中";
    case "支払い待ち":
      return "制作済み";
    case "発送待ち":
      return hasShippedAt ? "配送中" : "制作済み";
    case "完了":
      return "納品";
    case "失注":
      return "失注";
    default:
      // 想定外の値（手動編集等で壊れたデータ）は書き換えず現状維持にする。
      return legacy as unknown as OrderStatus;
  }
}

export async function migrateStatusesOnce(): Promise<void> {
  const flagRef = doc(db, META_COL, STATUS_MIGRATION_DOC);
  const flagSnap = await getDoc(flagRef);
  if (flagSnap.exists() && (flagSnap.data() as { migrated?: boolean }).migrated) {
    return;
  }
  const snapshot = await getDocs(collection(db, ORDERS_COL));
  const NEW_STATUSES = new Set<OrderStatus>([
    "問い合わせ中", "受注確定", "制作中", "制作済み", "配送中", "納品", "失注",
  ]);
  const summary: Record<string, number> = {};
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  for (const d of snapshot.docs) {
    const o = d.data() as Order & { completedAt?: number };
    // 既に新ステータス文字列なら移行対象外（新規作成分やこの関数の再実行時）。
    if (NEW_STATUSES.has(o.status as OrderStatus) && o.completedAt === undefined) continue;
    const legacy = o.status as unknown as LegacyStatus;
    const newStatus = mapLegacyStatus(legacy, !!o.shippedAt);
    const patch: Record<string, unknown> = { status: newStatus };
    if (legacy === "受信トレイ") patch.needsResponse = true;
    // completedAt は全ケース共通で paidAt へ引き継いでから削除する。
    if (typeof o.completedAt === "number") {
      patch.paidAt = o.completedAt;
      if (legacy === "完了") patch.deliveredAt = o.completedAt;
      patch.completedAt = deleteField();
    }
    updates.push({ id: d.id, patch });
    const key = `${legacy} → ${newStatus}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }
  // Firestore のバッチ上限（500オペ）を超えないよう分割コミット（backfillOrderNos と同じ方針）。
  const CHUNK = 400;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = writeBatch(db);
    updates.slice(i, i + CHUNK).forEach(({ id, patch }) => {
      batch.update(doc(db, ORDERS_COL, id), patch);
    });
    await batch.commit();
  }
  await setDoc(flagRef, { migrated: true, at: Date.now(), count: updates.length });
  if (updates.length > 0) {
    console.log(`[migrateStatusesOnce] ${updates.length}件を移行しました`, summary);
  }
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
