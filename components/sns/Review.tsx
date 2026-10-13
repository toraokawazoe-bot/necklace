"use client";

import { useEffect, useState } from "react";
import {
  CHANNEL_OPTIONS,
  Order,
  SNS_PLACES,
  SNS_PLACE_LABEL,
  SNS_WEEKDAYS,
  SnsKpt,
  SnsPolicy,
  SnsPostRecord,
  SnsWeeklyStat,
  isInstagramPost,
  isTikTok,
} from "@/lib/types";
import {
  DAY,
  deletePost,
  fmtDateTime,
  fmtNum,
  judgeFormats,
  median,
  needsNumbers,
  pct,
  saveKpt,
  updatePost,
  weekRange,
} from "@/lib/sns";
import { PILLAR_LABEL, Pillar } from "@/lib/snsKnowledge";
import { DebouncedNum, NumField } from "./common";
import styles from "../SnsPlan.module.css";

interface Props {
  policy: SnsPolicy;
  posts: SnsPostRecord[];
  orders: Order[];
  kpt: Record<string, SnsKpt>;
  legacyStats: SnsWeeklyStat[];
  ready: boolean;
  updatePolicy: (p: Partial<SnsPolicy>) => void;
  onMake: (formatId: string) => void;
}

const PAGE = 30;
const WEEKS = 8;
const EMPTY_KPT: SnsKpt = { keep: "", problem: "", try: "" };

function KptForm({ week, value }: { week: string; value: SnsKpt }) {
  const [v, setV] = useState<SnsKpt>(value);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setV(value);
  }, [value, editing]);
  const save = async (next: SnsKpt) => {
    setState("saving");
    try {
      await saveKpt(week, next);
      setState("saved");
    } catch (e) {
      console.error("kpt save failed", e);
      setState("error");
    }
  };
  const field = (k: keyof SnsKpt, label: string) => (
    <label className={styles.label}>
      {label}
      <textarea
        className={styles.input}
        rows={2}
        value={v[k]}
        onFocus={() => setEditing(true)}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
        onBlur={() => {
          setEditing(false);
          if (v[k] !== value[k]) save(v);
        }}
      />
    </label>
  );
  return (
    <>
      {field("keep", "続けること")}
      {field("problem", "困ったこと")}
      {field("try", "来週1つだけ試すこと")}
      <div className={state === "error" ? styles.warnText : styles.note} aria-live="polite">
        {state === "saving" ? "保存中…" : state === "saved" ? "保存済み" : state === "error" ? "保存できませんでした" : "入力欄から離れると保存します"}
      </div>
    </>
  );
}

export default function Review({ policy, posts, orders, kpt, legacyStats, ready, updatePolicy, onMake }: Props) {
  const now = Date.now();
  const [limit, setLimit] = useState(PAGE);
  const [newKw, setNewKw] = useState("");

  const feed = posts.filter((p) => p.place !== "igStory");
  const sortedFeed = feed
    .slice()
    .sort((a, b) => Number(needsNumbers(b, now)) - Number(needsNumbers(a, now)) || b.ts - a.ts);
  const missingCount = feed.filter((p) => needsNumbers(p, now)).length;

  const judged = judgeFormats(posts);

  // AI案を使った投稿と、使わなかった投稿の比べ(§4-E。比べる欄を足すだけ)
  const aiRows = [
    { label: "AI案を使った投稿", ps: feed.filter((p) => p.ai_used === true) },
    { label: "自分で作った投稿", ps: feed.filter((p) => p.ai_used !== true) },
  ].map(({ label, ps }) => {
    const withViews = ps.filter((p) => typeof p.views === "number");
    const rates = withViews
      .filter((p) => (p.views as number) > 0 && typeof p.saves === "number")
      .map((p) => (p.saves as number) / (p.views as number));
    return {
      label,
      total: ps.length,
      count: withViews.length,
      medianViews: median(withViews.map((p) => p.views as number)),
      medianSaveRate: median(rates),
    };
  });

  const saveNum = (p: SnsPostRecord, key: "views" | "saves", v: number | null) => {
    if (p[key] === v) return;
    updatePost(p.id, { [key]: v }).catch((e) => {
      console.error("update post failed", e);
      alert("保存できませんでした。通信状況を確認してもう一度お試しください。");
    });
  };

  const remove = async (p: SnsPostRecord) => {
    if (!confirm("この投稿の記録を削除しますか?")) return;
    try {
      await deletePost(p.id);
    } catch (e) {
      console.error("delete post failed", e);
      alert("削除できませんでした。");
    }
  };

  // 週の合計(今週から過去8週)
  const thisWeek = weekRange(now);
  const weeks = Array.from({ length: WEEKS }, (_, i) => weekRange(thisWeek.start - i * 7 * DAY + DAY));
  const weekRows = weeks.map((w) => {
    const ps = posts.filter((p) => p.ts >= w.start && p.ts < w.end);
    const fp = ps.filter((p) => p.place !== "igStory");
    const views = fp.reduce((s, p) => s + (p.views ?? 0), 0);
    const saves = fp.reduce((s, p) => s + (p.saves ?? 0), 0);
    const viewsKnown = fp.filter((p) => p.views != null);
    const savesForRate = viewsKnown.filter((p) => p.saves != null);
    const rateViews = savesForRate.reduce((s, p) => s + (p.views ?? 0), 0);
    const rateSaves = savesForRate.reduce((s, p) => s + (p.saves ?? 0), 0);
    const os = orders.filter((o) => o.created >= w.start && o.created < w.end);
    const ch: Record<string, number> = {};
    for (const o of os) {
      const c = o.channel || "未選択";
      ch[c] = (ch[c] ?? 0) + 1;
    }
    return {
      w,
      posts: fp.length,
      tiktok: ps.filter((p) => isTikTok(p.place)).length,
      ig: ps.filter((p) => isInstagramPost(p.place)).length,
      reel: ps.filter((p) => p.place === "igReel").length,
      stories: ps.length - fp.length,
      views: viewsKnown.length ? views : null,
      saves: fp.some((p) => p.saves != null) ? saves : null,
      rate: pct(rateSaves, rateViews),
      orders: os.length,
      channels: [...CHANNEL_OPTIONS, "未選択"].filter((c) => ch[c]).map((c) => `${c} ${ch[c]}`).join("・"),
    };
  });

  const pillarSum = policy.pillars.wear + policy.pillars.buy + policy.pillars.daily + policy.pillars.learn;
  const curKpt = kpt[thisWeek.key] ?? EMPTY_KPT;
  const pastKpt = Object.keys(kpt)
    .filter((k) => k !== thisWeek.key)
    .sort()
    .reverse();

  const addKw = () => {
    const k = newKw.trim();
    if (!k || policy.keywords.indexOf(k) !== -1) return;
    updatePolicy({ keywords: [...policy.keywords, k] });
    setNewKw("");
  };

  return (
    <>
      <section className={styles.card}>
        <h3 className={styles.h3}>投稿ごとの数字</h3>
        <div className={styles.note}>
          投稿から3日たったら、再生数と保存数を入れる。入れ忘れ:<span className={missingCount ? styles.warnText : undefined}>{missingCount}本</span>
        </div>
        {sortedFeed.length === 0 && <div className={styles.note}>まだ投稿の記録がありません。「作る」の一番下から記録します。</div>}
        <ul className={styles.list}>
          {sortedFeed.slice(0, limit).map((p) => {
            const miss = needsNumbers(p, now);
            return (
              <li key={p.id} className={`${styles.postRow} ${miss ? styles.missing : ""}`}>
                <div className={styles.postHead}>
                  <div className={styles.listMain}>
                    <strong>{fmtDateTime(p.ts)}</strong> <span className={styles.dim}>{SNS_PLACE_LABEL[p.place]}</span>
                    <div className={styles.dim}>
                      {p.formatLabel}
                      {p.hook ? `「${p.hook}」` : ""}
                      {p.keyword ? `/${p.keyword}` : ""}
                      {p.memo ? `/${p.memo}` : ""}
                    </div>
                    {miss && <div className={styles.warnText}>数字を入れてください</div>}
                  </div>
                  <button type="button" className={styles.del} onClick={() => remove(p)} aria-label="この投稿の記録を削除">
                    削除
                  </button>
                </div>
                <div className={styles.numRow}>
                  <label className={styles.label}>
                    再生数
                    <DebouncedNum label="再生数" value={p.views} onSave={(v) => saveNum(p, "views", v)} />
                  </label>
                  <label className={styles.label}>
                    保存数
                    <DebouncedNum label="保存数" value={p.saves} onSave={(v) => saveNum(p, "saves", v)} />
                  </label>
                  <div className={styles.rateCell}>
                    <span className={styles.dim}>保存率</span>
                    <strong>{pct(p.saves, p.views)}</strong>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {sortedFeed.length > limit && (
          <button type="button" className={styles.secondary} onClick={() => setLimit((n) => n + PAGE)}>
            もっと見る({sortedFeed.length - limit}本)
          </button>
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>型ごとの比べ</h3>
        <div className={styles.note}>
          全投稿の再生中央値 {judged.overallMedian == null ? "—" : fmtNum(Math.round(judged.overallMedian))}/下位25%の線{" "}
          {judged.p25 == null ? "—" : fmtNum(Math.round(judged.p25))}
        </div>
        {judged.stats.length === 0 ? (
          <div className={styles.note}>まだ比べられる投稿がありません</div>
        ) : (
          <ul className={styles.list}>
            {judged.stats.map((s) => (
              <li key={s.key} className={styles.formatStat}>
                <div className={styles.postHead}>
                  <strong>{s.label}</strong>
                  <span
                    className={`${styles.verdict} ${
                      s.verdict === "続ける" ? styles.verdictGood : s.verdict === "やめる候補" ? styles.verdictBad : ""
                    }`}
                  >
                    {s.verdict.replace(/\(.*\)$/, "")}
                  </span>
                </div>
                <div className={styles.dim}>
                  本数 {s.count}
                  {s.total !== s.count ? `(記録${s.total})` : ""}/再生の中央値 {s.medianViews == null ? "—" : fmtNum(Math.round(s.medianViews))}/保存率の中央値{" "}
                  {s.medianSaveRate == null ? "—" : `${(s.medianSaveRate * 100).toFixed(1)}%`}
                </div>
                {s.verdict.startsWith("直す") && <div className={styles.note}>1枚目・文字・時間のどれか1つだけ変える</div>}
                {s.verdict.startsWith("保留") && <div className={styles.note}>まだ判断しない(数字が入った投稿が3本になるまで)</div>}
                {s.formatId && (
                  <button type="button" className={styles.linkBtn} onClick={() => onMake(s.formatId as string)}>
                    この型で作る ›
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <details className={styles.details}>
          <summary className={styles.summarySmall}>判定のきまり</summary>
          <ul className={styles.plainList}>
            <li>3本未満 → 保留(まだ判断しない)</li>
            <li>直近3本のうち2本以上が、全投稿の再生中央値を上回る → 続ける</li>
            <li>直近3本がすべて下位25% → やめる候補</li>
            <li>それ以外 → 直す(1枚目・文字・時間のどれか1つだけ変える)</li>
          </ul>
        </details>
      </section>

      {aiRows[0].total > 0 && (
        <section className={styles.card}>
          <h3 className={styles.h3}>AI案と自分で作った投稿の比べ</h3>
          <div className={styles.note}>AI案を使った過去の投稿と、使わなかった投稿の数字です(判定のきまりは変えません)。</div>
          <ul className={styles.list}>
            {aiRows.map((r) => (
              <li key={r.label} className={styles.formatStat}>
                <strong>{r.label}</strong>
                <div className={styles.dim}>
                  本数 {r.count}
                  {r.total !== r.count ? `(記録${r.total})` : ""}/再生の中央値 {r.medianViews == null ? "—" : fmtNum(Math.round(r.medianViews))}/保存率の中央値{" "}
                  {r.medianSaveRate == null ? "—" : `${(r.medianSaveRate * 100).toFixed(1)}%`}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.card}>
        <h3 className={styles.h3}>週の合計</h3>
        <div className={styles.note}>
          目標:TikTok {policy.tiktokPerWeek}本/Instagram {policy.igPerWeek}本(うちリール{policy.igReelPerWeek})/ストーリーズ {policy.storiesPerDay * 7}枚
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>週</th>
                <th>本数</th>
                <th>TikTok</th>
                <th>IG</th>
                <th>ストーリーズ</th>
                <th>再生</th>
                <th>保存</th>
                <th>保存率</th>
                <th>注文</th>
                <th>注文の内訳</th>
              </tr>
            </thead>
            <tbody>
              {weekRows.map((r) => (
                <tr key={r.w.key}>
                  <td>{r.w.label.replace(/\(.\)/g, "")}</td>
                  <td>{r.posts}</td>
                  <td className={r.tiktok < policy.tiktokPerWeek ? styles.warnText : undefined}>
                    {r.tiktok}/{policy.tiktokPerWeek}
                  </td>
                  <td className={r.ig < policy.igPerWeek ? styles.warnText : undefined}>
                    {r.ig}/{policy.igPerWeek}
                    {r.reel ? `(リール${r.reel})` : ""}
                  </td>
                  <td>{r.stories}</td>
                  <td>{fmtNum(r.views)}</td>
                  <td>{fmtNum(r.saves)}</td>
                  <td>{r.rate}</td>
                  <td>{r.orders}</td>
                  <td className={styles.memoCell}>{r.channels || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.note}>今週の行は途中経過です。再生・保存は入力済みの投稿だけを足しています。</div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>週のふり返りメモ</h3>
        <div className={styles.note}>{thisWeek.label}</div>
        {ready && <KptForm key={thisWeek.key} week={thisWeek.key} value={curKpt} />}
        {pastKpt.length > 0 && (
          <details className={styles.details}>
            <summary className={styles.summarySmall}>これまでのメモ</summary>
            <ul className={styles.list}>
              {pastKpt.map((k) => (
                <li key={k} className={styles.listItemCol}>
                  <strong>{k} の週</strong>
                  {kpt[k].keep && <div>続ける:{kpt[k].keep}</div>}
                  {kpt[k].problem && <div>困った:{kpt[k].problem}</div>}
                  {kpt[k].try && <div>試す:{kpt[k].try}</div>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>週の方針</h3>
        <div className={styles.grid2}>
          <label className={styles.label}>
            TikTok 本/週
            <NumField label="TikTok 本/週" step="1" value={policy.tiktokPerWeek} onChange={(v) => updatePolicy({ tiktokPerWeek: v ?? 0 })} />
          </label>
          <label className={styles.label}>
            Instagram 本/週
            <NumField label="Instagram 本/週" step="1" value={policy.igPerWeek} onChange={(v) => updatePolicy({ igPerWeek: v ?? 0 })} />
          </label>
          <label className={styles.label}>
            うちリール
            <NumField label="うちリール" step="1" value={policy.igReelPerWeek} onChange={(v) => updatePolicy({ igReelPerWeek: v ?? 0 })} />
          </label>
          <label className={styles.label}>
            ストーリーズ 枚/日
            <NumField label="ストーリーズ 枚/日" step="1" value={policy.storiesPerDay} onChange={(v) => updatePolicy({ storiesPerDay: v ?? 0 })} />
          </label>
          <label className={styles.label}>
            「人が着けた姿」%以上
            <NumField label="人が着けた姿の割合" step="1" value={policy.wearingMinPct} onChange={(v) => updatePolicy({ wearingMinPct: v ?? 0 })} />
          </label>
          <label className={styles.label}>
            告知は週◯本まで
            <NumField label="告知の上限" step="1" value={policy.noticeMaxPerWeek} onChange={(v) => updatePolicy({ noticeMaxPerWeek: v ?? 0 })} />
          </label>
        </div>
        <div className={styles.note}>TikTokは写真スライドで可(動画は任意)。Instagramは週のうち1本をリールに。</div>
        <label className={styles.label}>
          投稿する時間
          <input className={styles.input} type="text" value={policy.postTime} onChange={(e) => updatePolicy({ postTime: e.target.value })} />
        </label>

        <div className={styles.fieldTitle}>休みの曜日</div>
        <div className={styles.chips} role="group" aria-label="休みの曜日">
          {SNS_WEEKDAYS.map((w) => {
            const on = policy.restDays.indexOf(w) !== -1;
            return (
              <button
                key={w}
                type="button"
                className={`${styles.chip} ${styles.chipNum} ${on ? styles.chipOn : ""}`}
                aria-pressed={on}
                onClick={() => updatePolicy({ restDays: on ? policy.restDays.filter((x) => x !== w) : [...policy.restDays, w] })}
              >
                {w}
              </button>
            );
          })}
        </div>

        <div className={styles.fieldTitle}>曜日ごとの予定投稿(今日の画面に出ます)</div>
        {SNS_WEEKDAYS.map((w) => (
          <div key={w} className={styles.schedRow}>
            <span className={styles.schedDay}>{w}</span>
            <div className={styles.chips}>
              {SNS_PLACES.filter((p) => p !== "igStory").map((p) => {
                const on = policy.schedule[w].indexOf(p) !== -1;
                return (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.chip} ${styles.chipSmall} ${on ? styles.chipOn : ""}`}
                    aria-pressed={on}
                    onClick={() =>
                      updatePolicy({
                        schedule: {
                          ...policy.schedule,
                          [w]: on ? policy.schedule[w].filter((x) => x !== p) : [...policy.schedule[w], p],
                        },
                      })
                    }
                  >
                    {SNS_PLACE_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className={styles.fieldTitle}>型の割合(投稿の柱・%)</div>
        <div className={styles.grid2}>
          {(Object.keys(PILLAR_LABEL) as Pillar[]).map((k) => (
            <label key={k} className={styles.label}>
              {PILLAR_LABEL[k]}
              <NumField
                label={PILLAR_LABEL[k]}
                step="1"
                value={policy.pillars[k]}
                onChange={(v) => updatePolicy({ pillars: { ...policy.pillars, [k]: v ?? 0 } })}
              />
            </label>
          ))}
        </div>
        <div className={pillarSum === 100 ? styles.note : styles.warnText}>合計 {pillarSum}%(告知は週1本まで、12月は30%まで。作っている過程はストーリーズへ)</div>

        <div className={styles.fieldTitle}>キーワード一覧</div>
        <div className={styles.note}>1投稿に1つ。1枚目の文字・文章の最初・声に入れる</div>
        <ul className={styles.kwList}>
          {policy.keywords.map((k, i) => (
            <li key={k + i} className={styles.kw}>
              <span>{k}</span>
              <button
                type="button"
                className={styles.del}
                aria-label={`${k}を削除`}
                onClick={() => updatePolicy({ keywords: policy.keywords.filter((_, j) => j !== i) })}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            type="text"
            placeholder="キーワードを追加"
            value={newKw}
            onChange={(e) => setNewKw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) addKw();
            }}
          />
          <button type="button" className={styles.secondary} onClick={addKw}>
            追加
          </button>
        </div>
      </section>

      {legacyStats.length > 0 && (
        <section className={styles.card}>
          <details className={styles.details}>
            <summary className={styles.summarySmall}>以前の週の数字(前の画面で入れたもの)</summary>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>週(月曜)</th>
                    <th>TikTok再生</th>
                    <th>保存</th>
                    <th>保存率</th>
                    <th>検索%</th>
                    <th>IG送信</th>
                    <th>届いた人</th>
                    <th>訪問</th>
                    <th>タップ</th>
                    <th>メモ</th>
                  </tr>
                </thead>
                <tbody>
                  {legacyStats.map((s) => (
                    <tr key={s.weekStart}>
                      <td>{s.weekStart}</td>
                      <td>{fmtNum(s.tiktokViews)}</td>
                      <td>{fmtNum(s.tiktokSaves)}</td>
                      <td>{pct(s.tiktokSaves, s.tiktokViews)}</td>
                      <td>{s.tiktokSearchPct == null ? "—" : `${s.tiktokSearchPct}%`}</td>
                      <td>{fmtNum(s.igReelSends)}</td>
                      <td>{fmtNum(s.igReelReach)}</td>
                      <td>{fmtNum(s.igProfileVisits)}</td>
                      <td>{fmtNum(s.igLinkTaps)}</td>
                      <td className={styles.memoCell}>{s.memo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </>
  );
}
