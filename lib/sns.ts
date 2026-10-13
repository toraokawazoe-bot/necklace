import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { SETTINGS } from "./collections";
import { SnsPlanData, SnsWeeklyStat } from "./types";

// 保存先: settings/sns （既存の settings コレクション。settings/main とは別ドキュメント）
export const SNS_DOC = "sns";

export const DEFAULT_SNS: SnsPlanData = {
  tiktokPerWeek: 3,
  tiktokVideoPerWeek: 1,
  igFeedPerWeek: 2,
  igReelPerWeek: 1,
  igStoryPerDay: 2,
  postTime: "18:00",
  restDay: "月",
  contentTypes: [
    { id: "neck", label: "首元が主役", desc: "1枚目に着けた首元", enabled: true },
    { id: "coord", label: "1本で3コーデ", desc: "同じ1本を3通りに着る", enabled: true },
    { id: "making", label: "作っているところ", desc: "制作中の手元", enabled: true },
    { id: "pack", label: "梱包・発送", desc: "包んでいるところ", enabled: true },
    { id: "notice", label: "告知", desc: "ポップアップ・再販", enabled: true },
  ],
  keywords: ["差し色ネックレス", "プチプラ アクセサリー", "ビーズアクセ", "ウィメンズ ネックレス"],
  posts: [],
  stats: {},
};

export function normalizeSns(raw: Partial<SnsPlanData> | undefined): SnsPlanData {
  const d = DEFAULT_SNS;
  const r = raw ?? {};
  const num = (v: unknown, fb: number) => (typeof v === "number" && !Number.isNaN(v) ? v : fb);
  return {
    tiktokPerWeek: num(r.tiktokPerWeek, d.tiktokPerWeek),
    tiktokVideoPerWeek: num(r.tiktokVideoPerWeek, d.tiktokVideoPerWeek),
    igFeedPerWeek: num(r.igFeedPerWeek, d.igFeedPerWeek),
    igReelPerWeek: num(r.igReelPerWeek, d.igReelPerWeek),
    igStoryPerDay: num(r.igStoryPerDay, d.igStoryPerDay),
    postTime: typeof r.postTime === "string" ? r.postTime : d.postTime,
    restDay: typeof r.restDay === "string" ? r.restDay : d.restDay,
    contentTypes: Array.isArray(r.contentTypes) && r.contentTypes.length ? r.contentTypes : d.contentTypes,
    keywords: Array.isArray(r.keywords) ? r.keywords : d.keywords,
    posts: Array.isArray(r.posts) ? r.posts : [],
    stats: r.stats && typeof r.stats === "object" ? r.stats : {},
  };
}

export function subscribeSns(
  onData: (data: SnsPlanData, hasPendingWrites: boolean) => void,
  onError?: (e: unknown) => void
): () => void {
  return onSnapshot(
    doc(db, SETTINGS, SNS_DOC),
    (snap) => onData(normalizeSns(snap.exists() ? (snap.data() as Partial<SnsPlanData>) : undefined), snap.metadata.hasPendingWrites),
    (e) => {
      console.error("[subscribeSns]", e);
      onError?.(e);
    }
  );
}

export async function saveSns(data: SnsPlanData): Promise<void> {
  // Firestore は undefined を受け付けないので除去する
  const clean = JSON.parse(JSON.stringify(data));
  await setDoc(doc(db, SETTINGS, SNS_DOC), clean);
}

// ---- 週の計算（日本時間・月曜始まり）----
const JST = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function ymd(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// その時刻が属する週の月曜 0:00（日本時間）を UTC ミリ秒で返す
export function weekStartMs(now: number): number {
  const j = now + JST;
  const dow = new Date(j).getUTCDay(); // 0=日
  const sinceMon = (dow + 6) % 7;
  const dayStartJst = Math.floor(j / DAY) * DAY;
  return dayStartJst - sinceMon * DAY - JST;
}

export function weekKey(now: number): string {
  return ymd(weekStartMs(now) + JST);
}

export function weekRange(now: number): { start: number; end: number; label: string } {
  const start = weekStartMs(now);
  const end = start + 7 * DAY;
  const s = new Date(start + JST);
  const e = new Date(end - DAY + JST);
  return {
    start,
    end,
    label: `${s.getUTCMonth() + 1}/${s.getUTCDate()}(月)〜${e.getUTCMonth() + 1}/${e.getUTCDate()}(日)`,
  };
}

export function emptyStat(weekStart: string): SnsWeeklyStat {
  return {
    weekStart,
    tiktokViews: null,
    tiktokSaves: null,
    tiktokSearchPct: null,
    igReelSends: null,
    igReelReach: null,
    igProfileVisits: null,
    igLinkTaps: null,
    memo: "",
  };
}

export function pct(n: number | null, d: number | null): string {
  if (n == null || d == null || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}
