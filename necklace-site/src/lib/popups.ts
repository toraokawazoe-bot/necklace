// ポップアップ(対面販売)の予定。ここに足すと /popup に載る。
// 予定が決まったら下の配列に1件ずつ追加する。終わった予定は自動で非表示になる(消さなくてよい)。
//
//   name      イベント名・場所の見出し       例: "740NLL ポップアップ in 渋谷"
//   startDate 開始日(日本時間) "YYYY-MM-DD"  例: "2026-11-21"
//   endDate   最終日。1日だけなら省略         例: "2026-11-22"
//   time      時間                            例: "11:00〜18:00(最終日は17:00まで)"
//   venue     会場名                          例: "○○ギャラリー"
//   address   住所(地図リンクの元になる)
//   mapUrl    地図のURL。省略すると address から Googleマップの検索URLを作る
//   note      一言(任意)                     例: "新作のスマホストラップも並びます"
//   url       会場やイベントのページ(任意)

export type Popup = {
  name: string;
  startDate: string;
  endDate?: string;
  time: string;
  venue: string;
  address: string;
  mapUrl?: string;
  note?: string;
  url?: string;
};

export const POPUPS: Popup[] = [];

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function parse(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, wd: WEEKDAYS[wd] };
}

/** 日本時間の今日 "YYYY-MM-DD" */
export function todayInJapan(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/** 「11月21日(土)〜22日(日)」「11月21日(土)」 */
export function formatPopupDates(p: Pick<Popup, "startDate" | "endDate">): string {
  const s = parse(p.startDate);
  const head = `${s.m}月${s.d}日(${s.wd})`;
  if (!p.endDate || p.endDate === p.startDate) return head;
  const e = parse(p.endDate);
  const tail =
    e.m === s.m ? `${e.d}日(${e.wd})` : `${e.m}月${e.d}日(${e.wd})`;
  return `${head}〜${tail}`;
}

export function popupMapUrl(p: Pick<Popup, "mapUrl" | "address" | "venue">): string {
  if (p.mapUrl) return p.mapUrl;
  const q = encodeURIComponent(`${p.venue} ${p.address}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** 今日(日本時間)以降のものだけ、開始日の早い順 */
export function upcomingPopups(
  list: Popup[] = POPUPS,
  now: Date = new Date(),
): Popup[] {
  const today = todayInJapan(now);
  return list
    .filter((p) => (p.endDate ?? p.startDate) >= today)
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
