import {
  FieldPath,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { SETTINGS, SNS_IDEAS, SNS_IDEA_IMAGES, SNS_POSTS, SNS_SETTINGS_DOC } from "./collections";
import {
  SNS_WEEKDAYS,
  SnsIdea,
  SnsKpt,
  SnsPlace,
  SnsPolicy,
  SnsPost,
  SnsPostRecord,
  SnsWeekday,
  SnsWeeklyStat,
} from "./types";
import { DEFAULT_KEYWORDS, FORMAT_CARDS } from "./snsKnowledge";

// 保存先:
//   settings/sns         … policy(週の方針) / kpt(週のふり返りメモ)。旧データ(posts / stats ほか)もここに残っている
//   sns_ideas/{id}       … アイデア1件
//   sns_idea_images/{id} … アイデアのスクショ本体 { data: dataURL }
//   sns_posts/{id}       … 投稿の記録1件
// 旧 settings/sns の posts は sns_posts へ一度だけ写し(postsMigratedAt を立てる)、元のフィールドは消さない。

// ---- 週の方針 ----
export const DEFAULT_POLICY: SnsPolicy = {
  tiktokPerWeek: 3,
  igPerWeek: 2,
  igReelPerWeek: 1,
  storiesPerDay: 2,
  wearingMinPct: 50,
  noticeMaxPerWeek: 1,
  postTime: "17:00〜19:00",
  restDays: [],
  schedule: {
    月: [],
    火: ["tiktokPhoto"],
    水: ["igFeed"],
    木: ["tiktokPhoto"],
    金: [],
    土: ["tiktokPhoto"],
    日: ["igReel"],
  },
  pillars: { wear: 40, buy: 20, daily: 20, learn: 20 },
  keywords: DEFAULT_KEYWORDS,
};

const PLACES: SnsPlace[] = ["tiktokPhoto", "tiktokVideo", "igFeed", "igReel", "igStory"];

function num(v: unknown, fb: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fb;
}

function isWeekday(v: unknown): v is SnsWeekday {
  return typeof v === "string" && (SNS_WEEKDAYS as string[]).indexOf(v) !== -1;
}

// settings/sns の生データから方針を作る。policy が無ければ新しい初期値を使い、
// 旧画面で編集していたキーワード・休みの曜日だけは引き継ぐ。
export function normalizePolicy(raw: Record<string, unknown> | undefined): SnsPolicy {
  const d = DEFAULT_POLICY;
  const r = (raw ?? {}) as Record<string, unknown>;
  const p = r.policy && typeof r.policy === "object" ? (r.policy as Record<string, unknown>) : null;
  if (!p) {
    const legacyKw = Array.isArray(r.keywords) ? (r.keywords as unknown[]).filter((k): k is string => typeof k === "string") : null;
    let keywords = d.keywords;
    if (legacyKw && legacyKw.length) {
      keywords = legacyKw.indexOf("ビーズネックレス") === -1 ? ["ビーズネックレス", ...legacyKw] : legacyKw;
    }
    const restDays: SnsWeekday[] = isWeekday(r.restDay) ? [r.restDay] : [];
    const schedule = { ...d.schedule };
    for (const w of restDays) schedule[w] = [];
    return { ...d, keywords, restDays, schedule };
  }
  const sched = {} as SnsPolicy["schedule"];
  const rawSched = p.schedule && typeof p.schedule === "object" ? (p.schedule as Record<string, unknown>) : {};
  for (const w of SNS_WEEKDAYS) {
    const v = rawSched[w];
    sched[w] = Array.isArray(v) ? (v as unknown[]).filter((x): x is SnsPlace => PLACES.indexOf(x as SnsPlace) !== -1) : d.schedule[w];
  }
  const pil = p.pillars && typeof p.pillars === "object" ? (p.pillars as Record<string, unknown>) : {};
  return {
    tiktokPerWeek: num(p.tiktokPerWeek, d.tiktokPerWeek),
    igPerWeek: num(p.igPerWeek, d.igPerWeek),
    igReelPerWeek: num(p.igReelPerWeek, d.igReelPerWeek),
    storiesPerDay: num(p.storiesPerDay, d.storiesPerDay),
    wearingMinPct: num(p.wearingMinPct, d.wearingMinPct),
    noticeMaxPerWeek: num(p.noticeMaxPerWeek, d.noticeMaxPerWeek),
    postTime: typeof p.postTime === "string" ? p.postTime : d.postTime,
    restDays: Array.isArray(p.restDays) ? (p.restDays as unknown[]).filter(isWeekday) : d.restDays,
    schedule: sched,
    pillars: {
      wear: num(pil.wear, d.pillars.wear),
      buy: num(pil.buy, d.pillars.buy),
      daily: num(pil.daily, d.pillars.daily),
      learn: num(pil.learn, d.pillars.learn),
    },
    keywords: Array.isArray(p.keywords) ? (p.keywords as unknown[]).filter((k): k is string => typeof k === "string") : d.keywords,
  };
}

export interface SnsSettingsState {
  policy: SnsPolicy;
  kpt: Record<string, SnsKpt>;
  legacyPosts: SnsPost[];
  legacyStats: SnsWeeklyStat[];
  postsMigrated: boolean;
}

export function subscribeSnsSettings(
  onData: (s: SnsSettingsState, hasPendingWrites: boolean) => void,
  onError?: (e: unknown) => void
): () => void {
  return onSnapshot(
    doc(db, SETTINGS, SNS_SETTINGS_DOC),
    (snap) => {
      const raw = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
      const r = raw ?? {};
      const kptRaw = r.kpt && typeof r.kpt === "object" ? (r.kpt as Record<string, SnsKpt>) : {};
      const statsRaw = r.stats && typeof r.stats === "object" ? (r.stats as Record<string, SnsWeeklyStat>) : {};
      onData(
        {
          policy: normalizePolicy(raw),
          kpt: kptRaw,
          legacyPosts: Array.isArray(r.posts) ? (r.posts as SnsPost[]) : [],
          legacyStats: Object.keys(statsRaw)
            .map((k) => statsRaw[k])
            .filter((s) => s && typeof s.weekStart === "string")
            .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)),
          postsMigrated: typeof r.postsMigratedAt === "number",
        },
        snap.metadata.hasPendingWrites
      );
    },
    (e) => {
      console.error("[subscribeSnsSettings]", e);
      onError?.(e);
    }
  );
}

function clean<T>(v: T): T {
  // Firestore は undefined を受け付けないので除去する
  return JSON.parse(JSON.stringify(v));
}

// policy フィールドだけを置き換える(旧データのフィールドには触れない)
export async function savePolicy(policy: SnsPolicy): Promise<void> {
  await setDoc(doc(db, SETTINGS, SNS_SETTINGS_DOC), { policy: clean(policy) }, { mergeFields: ["policy"] });
}

export async function saveKpt(week: string, kpt: SnsKpt): Promise<void> {
  await setDoc(
    doc(db, SETTINGS, SNS_SETTINGS_DOC),
    { kpt: { [week]: clean(kpt) } },
    { mergeFields: [new FieldPath("kpt", week)] }
  );
}

// ---- 旧データの移行(一度だけ・何度呼んでも同じ結果) ----
const LEGACY_PLACE: Record<string, SnsPlace> = { tiktok: "tiktokPhoto", igFeed: "igFeed", igStory: "igStory" };
const LEGACY_FORMAT: Record<string, string> = {
  首元が主役: "neck",
  "1本で3コーデ": "coord3",
  作っているところ: "making",
  "梱包・発送": "making",
  告知: "notice",
};

export async function migrateLegacyPostsOnce(legacy: SnsPost[]): Promise<number> {
  let n = 0;
  for (const p of legacy) {
    if (!p || typeof p.id !== "string" || !p.id || typeof p.ts !== "number") continue;
    const ref = doc(db, SNS_POSTS, p.id);
    const snap = await getDoc(ref);
    if (snap.exists()) continue; // 既に写してある(その後の編集を上書きしない)
    const formatId = LEGACY_FORMAT[p.contentType];
    const rec: SnsPostRecord = {
      id: p.id,
      ts: p.ts,
      place: LEGACY_PLACE[p.platform] ?? "tiktokPhoto",
      formatId,
      formatLabel: p.contentType || "",
      memo: p.memo || "",
      wearing: formatId === "neck" || formatId === "coord3",
      notice: formatId === "notice",
      views: null,
      saves: null,
      legacy: true,
    };
    await setDoc(ref, clean(rec));
    n++;
  }
  // 写し終えた目印。旧 posts フィールドは消さずに残す。
  await setDoc(doc(db, SETTINGS, SNS_SETTINGS_DOC), { postsMigratedAt: Date.now() }, { merge: true });
  return n;
}

// ---- アイデア ----
export function subscribeIdeas(onData: (ideas: SnsIdea[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    collection(db, SNS_IDEAS),
    (snap) => {
      const list = snap.docs.map((d) => {
        const v = d.data() as Partial<SnsIdea>;
        return {
          ...v,
          id: d.id,
          created: typeof v.created === "number" ? v.created : 0,
          text: typeof v.text === "string" ? v.text : "",
          source: v.source === "ios-share" ? "ios-share" : "app",
          status: v.status ?? "未仕分け",
        } as SnsIdea;
      });
      list.sort((a, b) => b.created - a.created);
      onData(list);
    },
    (e) => {
      console.error("[subscribeIdeas]", e);
      onError?.(e);
    }
  );
}

export async function addIdea(input: { text: string; url?: string; image?: string }): Promise<string> {
  const ref = doc(collection(db, SNS_IDEAS));
  if (input.image) {
    await setDoc(doc(db, SNS_IDEA_IMAGES, ref.id), { data: input.image, created: Date.now() });
  }
  const idea: SnsIdea = {
    id: ref.id,
    created: Date.now(),
    text: input.text,
    url: input.url || undefined,
    hasImage: input.image ? true : undefined,
    source: "app",
    status: "未仕分け",
  };
  await setDoc(ref, clean(idea));
  return ref.id;
}

export async function updateIdea(id: string, patch: Partial<SnsIdea>): Promise<void> {
  const p = clean({ ...patch, updated: Date.now() }) as Record<string, unknown>;
  delete p.id;
  await updateDoc(doc(db, SNS_IDEAS, id), p);
}

export async function deleteIdea(idea: SnsIdea): Promise<void> {
  const b = writeBatch(db);
  b.delete(doc(db, SNS_IDEAS, idea.id));
  if (idea.hasImage) b.delete(doc(db, SNS_IDEA_IMAGES, idea.id));
  await b.commit();
}

export async function getIdeaImage(id: string): Promise<string | null> {
  const s = await getDoc(doc(db, SNS_IDEA_IMAGES, id));
  const d = s.exists() ? (s.data() as { data?: unknown }).data : null;
  return typeof d === "string" ? d : null;
}

// ---- 投稿の記録 ----
export function subscribePosts(onData: (posts: SnsPostRecord[]) => void, onError?: (e: unknown) => void): () => void {
  return onSnapshot(
    collection(db, SNS_POSTS),
    (snap) => {
      const list = snap.docs.map((d) => {
        const v = d.data() as Partial<SnsPostRecord>;
        return {
          ...v,
          id: d.id,
          ts: typeof v.ts === "number" ? v.ts : 0,
          place: v.place && PLACES.indexOf(v.place) !== -1 ? v.place : "tiktokPhoto",
          formatLabel: typeof v.formatLabel === "string" ? v.formatLabel : "",
          views: typeof v.views === "number" ? v.views : null,
          saves: typeof v.saves === "number" ? v.saves : null,
        } as SnsPostRecord;
      });
      list.sort((a, b) => b.ts - a.ts);
      onData(list);
    },
    (e) => {
      console.error("[subscribePosts]", e);
      onError?.(e);
    }
  );
}

export async function addPost(post: Omit<SnsPostRecord, "id">): Promise<string> {
  const ref = doc(collection(db, SNS_POSTS));
  await setDoc(ref, clean({ ...post, id: ref.id }));
  return ref.id;
}

export async function updatePost(id: string, patch: Partial<SnsPostRecord>): Promise<void> {
  const p = clean(patch) as Record<string, unknown>;
  delete p.id;
  // 数字を消した(null)ときも保存できるよう null はそのまま送る
  if (patch.views === null) p.views = null;
  if (patch.saves === null) p.saves = null;
  await updateDoc(doc(db, SNS_POSTS, id), p);
}

export async function deletePost(id: string): Promise<void> {
  await deleteDoc(doc(db, SNS_POSTS, id));
}

// ---- 日付(日本時間・月曜始まり) ----
const JST = 9 * 60 * 60 * 1000;
export const DAY = 24 * 60 * 60 * 1000;

function ymd(t: number): string {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 日本時間の日付 "YYYY-MM-DD"
export function jstDate(ms: number): string {
  return ymd(ms + JST);
}

export function jstDayStart(ms: number): number {
  return Math.floor((ms + JST) / DAY) * DAY - JST;
}

export function jstWeekday(ms: number): SnsWeekday {
  const dow = new Date(ms + JST).getUTCDay(); // 0=日
  return SNS_WEEKDAYS[(dow + 6) % 7];
}

export function fmtDateTime(ms: number): string {
  const d = new Date(ms + JST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function fmtDate(ms: number): string {
  const d = new Date(ms + JST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// datetime-local 入力用(日本時間)
export function toLocalInput(ms: number): string {
  const d = new Date(ms + JST);
  return `${ymd(ms + JST)}T${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
export function fromLocalInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - JST;
}

// その時刻が属する週の月曜 0:00(日本時間)を UTC ミリ秒で返す
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

export function weekRange(now: number): { start: number; end: number; key: string; label: string } {
  const start = weekStartMs(now);
  const end = start + 7 * DAY;
  const s = new Date(start + JST);
  const e = new Date(end - DAY + JST);
  return {
    start,
    end,
    key: ymd(start + JST),
    label: `${s.getUTCMonth() + 1}/${s.getUTCDate()}(月)〜${e.getUTCMonth() + 1}/${e.getUTCDate()}(日)`,
  };
}

// ---- 数字 ----
export function pct(n: number | null, d: number | null): string {
  if (n == null || d == null || d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export function fmtNum(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("ja-JP");
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// 分位点(線形補間)
export function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// 3日たっても再生数・保存数が入っていない投稿(ストーリーズは対象外)
export function needsNumbers(p: SnsPostRecord, now: number): boolean {
  return p.place !== "igStory" && now - p.ts >= 3 * DAY && (p.views == null || p.saves == null);
}

// ---- 型ごとの比べ(仕様書 §1 の判定ルール) ----
export type Verdict = "保留(まだ判断しない)" | "続ける" | "やめる候補" | "直す(1枚目・文字・時間のどれか1つだけ変える)";

export interface FormatStat {
  key: string; // formatId か、無ければ "label:" + formatLabel
  formatId?: string;
  label: string;
  count: number; // 再生数が入っている本数
  total: number; // 記録の本数
  medianViews: number | null;
  medianSaveRate: number | null; // 0〜1
  verdict: Verdict;
}

// 判定ルール(仕様書 §1):
//   再生数が入った投稿が3本未満 → 保留
//   直近3本のうち2本以上が、全投稿の再生中央値を上回る → 続ける
//   直近3本がすべて下位25%(全投稿の再生の25パーセンタイル以下) → やめる候補
//   それ以外 → 直す
export function judgeFormats(posts: SnsPostRecord[]): { stats: FormatStat[]; overallMedian: number | null; p25: number | null } {
  const target = posts.filter((p) => p.place !== "igStory");
  const allViews = target.filter((p) => p.views != null).map((p) => p.views as number);
  const overallMedian = median(allViews);
  const p25 = quantile(allViews, 0.25);

  const groups: Record<string, { label: string; formatId?: string; all: SnsPostRecord[] }> = {};
  for (const p of target) {
    const card = FORMAT_CARDS.find((f) => f.id === p.formatId);
    const key = card ? card.id : "label:" + (p.formatLabel || "(型なし)");
    if (!groups[key]) groups[key] = { label: card ? card.name : p.formatLabel || "(型なし)", formatId: card?.id, all: [] };
    groups[key].all.push(p);
  }

  const stats: FormatStat[] = Object.keys(groups).map((key) => {
    const g = groups[key];
    const measured = g.all.filter((p) => p.views != null).sort((a, b) => b.ts - a.ts);
    const views = measured.map((p) => p.views as number);
    const rates = measured
      .filter((p) => p.saves != null && (p.views as number) > 0)
      .map((p) => (p.saves as number) / (p.views as number));
    let verdict: Verdict;
    if (measured.length < 3 || overallMedian == null || p25 == null) {
      verdict = "保留(まだ判断しない)";
    } else {
      const last3 = views.slice(0, 3);
      if (last3.filter((v) => v > overallMedian).length >= 2) verdict = "続ける";
      else if (last3.every((v) => v <= p25)) verdict = "やめる候補";
      else verdict = "直す(1枚目・文字・時間のどれか1つだけ変える)";
    }
    return {
      key,
      formatId: g.formatId,
      label: g.label,
      count: measured.length,
      total: g.all.length,
      medianViews: median(views),
      medianSaveRate: median(rates),
      verdict,
    };
  });
  stats.sort((a, b) => b.count - a.count || b.total - a.total);
  return { stats, overallMedian, p25 };
}
