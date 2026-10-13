"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHANNEL_OPTIONS,
  Order,
  SNS_PLATFORM_LABEL,
  SnsPlanData,
  SnsPlatform,
  SnsWeeklyStat,
} from "@/lib/types";
import {
  DEFAULT_SNS,
  emptyStat,
  pct,
  saveSns,
  subscribeSns,
  weekKey,
  weekRange,
} from "@/lib/sns";
import styles from "./SnsPlan.module.css";

interface Props {
  orders: Order[];
}

const PLATFORMS: SnsPlatform[] = ["tiktok", "igFeed", "igStory"];
const DAYS = ["月", "火", "水", "木", "金", "土", "日", "なし"];

const TEMPLATES: { title: string; text: string }[] = [
  {
    title: "Instagram キャプション",
    text: "【新作】{色}ネックレス|{素材}|¥2,500|長さ{cm}cm|ご購入はプロフィールのリンクへ",
  },
  {
    title: "TikTok キャプション",
    text: "{キーワード}|¥2,500のビーズアクセ。{一言}",
  },
  {
    title: "TikTok プロフィール",
    text: "手作りビーズネックレス ¥2,500|購入は下のリンク",
  },
];

const WHY = [
  "一番伸びた投稿は首元が見えていた（4/20、8.28万回・保存861）",
  "1枚目に人がいない投稿は伸びなかった",
  "TikTokは検索から23.8%来ている",
  "Instagramはストーリーズが閲覧の83.5%",
  "TikTokの広告は、ほかの投稿の自然な再生に影響しない（公式）",
];

// 数字入力。入力途中の文字列はここで持ち、確定した数だけ親に返す。
function NumField({
  value,
  onChange,
  label,
  step,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  step?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const last = useRef(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current && value !== last.current) {
      last.current = value;
      setText(value == null ? "" : String(value));
    }
  }, [value]);
  return (
    <input
      className={styles.input}
      type="number"
      inputMode="decimal"
      step={step ?? "any"}
      min="0"
      aria-label={label}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(value == null ? "" : String(value));
        last.current = value;
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = t.trim() === "" ? null : Number(t);
        const v = n == null || Number.isNaN(n) ? null : n;
        last.current = v;
        onChange(v);
      }}
    />
  );
}

function Bar({ label, done, target, note }: { label: string; done: number; target: number; note?: string }) {
  const ratio = target > 0 ? Math.min(1, done / target) : 0;
  return (
    <div className={styles.barRow}>
      <div className={styles.barHead}>
        <span>{label}</span>
        <span className={styles.barNum}>
          {done}/{target}
        </span>
      </div>
      <div className={styles.barTrack} role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={done}>
        <div className={styles.barFill} style={{ width: `${ratio * 100}%` }} />
      </div>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}

function fmtNum(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("ja-JP");
}

export default function SnsPlan({ orders }: Props) {
  const [data, setData] = useState<SnsPlanData>(DEFAULT_SNS);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = subscribeSns(
      (d, pending) => {
        // 自分の編集が未保存の間は、受信データで上書きしない
        if (dirty.current || pending) return;
        setData(d);
        setReady(true);
      },
      () => setReady(true)
    );
    return () => {
      unsub();
      // 離れる時に未保存の変更があれば即保存
      if (timer.current) {
        clearTimeout(timer.current);
        if (dirty.current) saveSns(dataRef.current).catch((e) => console.error("sns save failed", e));
      }
    };
  }, []);

  const flush = async () => {
    timer.current = null;
    setSaveState("saving");
    const snapshot = dataRef.current;
    try {
      await saveSns(snapshot);
      if (dataRef.current === snapshot) dirty.current = false;
      setSaveState("saved");
    } catch (e) {
      console.error("sns save failed", e);
      setSaveState("error");
    }
  };

  // 変更を反映して、少し待ってから自動保存する
  const update = (patch: Partial<SnsPlanData>) => {
    if (!ready) return;
    const next = { ...dataRef.current, ...patch };
    dataRef.current = next;
    setData(next);
    dirty.current = true;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  // ---- 今週 ----
  const now = Date.now();
  const range = useMemo(() => weekRange(now), [now]);
  const wk = weekKey(now);
  const weekPosts = data.posts
    .filter((p) => p.ts >= range.start && p.ts < range.end)
    .sort((a, b) => b.ts - a.ts);
  const count = (pl: SnsPlatform) => weekPosts.filter((p) => p.platform === pl).length;

  const weekOrders = useMemo(() => orders.filter((o) => o.created >= range.start && o.created < range.end), [orders, range]);
  const orderByChannel = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of weekOrders) {
      const c = o.channel || "未選択";
      m[c] = (m[c] ?? 0) + 1;
    }
    return m;
  }, [weekOrders]);

  const [platform, setPlatform] = useState<SnsPlatform>("tiktok");
  const enabledTypes = data.contentTypes.filter((c) => c.enabled);
  const [ctype, setCtype] = useState("");
  const [memo, setMemo] = useState("");
  const effectiveType = enabledTypes.some((c) => c.label === ctype) ? ctype : enabledTypes[0]?.label ?? "";

  const addPost = () => {
    update({
      posts: [
        ...data.posts,
        { id: "p_" + Date.now(), ts: Date.now(), platform, contentType: effectiveType, memo: memo.trim() },
      ],
    });
    setMemo("");
  };
  const removePost = (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    update({ posts: data.posts.filter((p) => p.id !== id) });
  };

  // ---- 毎週の数字 ----
  const stat: SnsWeeklyStat = data.stats[wk] ?? emptyStat(wk);
  const setStat = (patch: Partial<SnsWeeklyStat>) =>
    update({ stats: { ...data.stats, [wk]: { ...stat, ...patch, weekStart: wk } } });
  const pastStats = Object.values(data.stats)
    .filter((s) => s.weekStart !== wk)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));

  // ---- キーワード ----
  const [newKw, setNewKw] = useState("");
  const addKw = () => {
    const k = newKw.trim();
    if (!k || data.keywords.includes(k)) return;
    update({ keywords: [...data.keywords, k] });
    setNewKw("");
  };

  const [copied, setCopied] = useState<number | null>(null);
  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* コピーできない環境では何もしない */
      }
      document.body.removeChild(ta);
    }
    setCopied(i);
    setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
  };

  const num = (v: number | null, fb: number) => v ?? fb;

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <h2 className={styles.h2}>SNS運用</h2>
        <span className={`${styles.saved} ${saveState === "error" ? styles.savedErr : ""}`} aria-live="polite">
          {!ready
            ? "読み込み中…"
            : saveState === "saving"
            ? "保存中…"
            : saveState === "saved"
            ? "保存済み"
            : saveState === "error"
            ? "保存できませんでした。通信を確認してください"
            : ""}
        </span>
      </div>

      {/* 今週のチェック */}
      <section className={styles.card}>
        <h3 className={styles.h3}>今週のチェック</h3>
        <div className={styles.note}>{range.label}</div>
        <Bar
          label="TikTok"
          done={count("tiktok")}
          target={data.tiktokPerWeek}
          note={`うち動画 ${data.tiktokVideoPerWeek} 本`}
        />
        <Bar
          label="Instagramフィード・リール"
          done={count("igFeed")}
          target={data.igFeedPerWeek}
          note={`うちリール ${data.igReelPerWeek} 本`}
        />
        <Bar label="ストーリーズ" done={count("igStory")} target={data.igStoryPerDay * 7} note={`1日 ${data.igStoryPerDay} 回 × 7日`} />

        <div className={styles.subHead}>投稿したら記録</div>
        <div className={styles.chips} role="group" aria-label="どこに投稿した？">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              className={`${styles.chip} ${platform === p ? styles.chipOn : ""}`}
              onClick={() => setPlatform(p)}
            >
              {SNS_PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
        <label className={styles.label}>
          内容
          <select className={styles.input} value={effectiveType} onChange={(e) => setCtype(e.target.value)}>
            {enabledTypes.length === 0 && <option value="">（内容が選ばれていません）</option>}
            {enabledTypes.map((c) => (
              <option key={c.id} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          メモ（なくてもOK）
          <input className={styles.input} type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <button type="button" className={styles.primary} onClick={addPost} disabled={!ready}>
          投稿した！を記録
        </button>

        {weekPosts.length > 0 ? (
          <ul className={styles.list}>
            {weekPosts.map((p) => {
              const d = new Date(p.ts + 9 * 3600 * 1000);
              return (
                <li key={p.id} className={styles.listItem}>
                  <div className={styles.listMain}>
                    <div>
                      <strong>{SNS_PLATFORM_LABEL[p.platform]}</strong>
                      <span className={styles.dim}>
                        {" "}
                        {d.getUTCMonth() + 1}/{d.getUTCDate()} {String(d.getUTCHours()).padStart(2, "0")}:
                        {String(d.getUTCMinutes()).padStart(2, "0")}
                      </span>
                    </div>
                    <div className={styles.dim}>
                      {p.contentType}
                      {p.memo ? `｜${p.memo}` : ""}
                    </div>
                  </div>
                  <button type="button" className={styles.del} onClick={() => removePost(p.id)} aria-label="この記録を削除">
                    削除
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.note}>今週の記録はまだありません</div>
        )}

        <div className={styles.subHead}>今週の注文：{weekOrders.length}件</div>
        {weekOrders.length > 0 ? (
          <div className={styles.note}>
            {[...CHANNEL_OPTIONS, "未選択"]
              .filter((c) => orderByChannel[c])
              .map((c) => `${c} ${orderByChannel[c]}件`)
              .join("／")}
          </div>
        ) : (
          <div className={styles.note}>今週はまだ注文がありません</div>
        )}
      </section>

      {/* 毎週の数字 */}
      <section className={styles.card}>
        <h3 className={styles.h3}>毎週の数字（日曜に記録）</h3>
        <div className={styles.note}>{range.label} の分</div>
        <div className={styles.grid2}>
          <label className={styles.label}>
            TikTok 再生数
            <NumField label="TikTok 再生数" value={stat.tiktokViews} onChange={(v) => setStat({ tiktokViews: v })} />
          </label>
          <label className={styles.label}>
            TikTok 保存数
            <NumField label="TikTok 保存数" value={stat.tiktokSaves} onChange={(v) => setStat({ tiktokSaves: v })} />
          </label>
          <label className={styles.label}>
            TikTok 検索からの割合(%)
            <NumField label="TikTok 検索からの割合" value={stat.tiktokSearchPct} onChange={(v) => setStat({ tiktokSearchPct: v })} />
          </label>
          <label className={styles.label}>
            Instagram リールの送信数
            <NumField label="Instagram リールの送信数" value={stat.igReelSends} onChange={(v) => setStat({ igReelSends: v })} />
          </label>
          <label className={styles.label}>
            Instagram リールの届いた人数
            <NumField label="Instagram リールの届いた人数" value={stat.igReelReach} onChange={(v) => setStat({ igReelReach: v })} />
          </label>
          <label className={styles.label}>
            Instagram プロフィール訪問
            <NumField label="Instagram プロフィール訪問" value={stat.igProfileVisits} onChange={(v) => setStat({ igProfileVisits: v })} />
          </label>
          <label className={styles.label}>
            Instagram リンクのタップ数
            <NumField label="Instagram リンクのタップ数" value={stat.igLinkTaps} onChange={(v) => setStat({ igLinkTaps: v })} />
          </label>
        </div>
        <label className={styles.label}>
          メモ
          <textarea className={styles.input} rows={2} value={stat.memo} onChange={(e) => setStat({ memo: e.target.value })} />
        </label>
        <div className={styles.calc}>
          <div>
            TikTok 保存率（保存÷再生）<strong>{pct(stat.tiktokSaves, stat.tiktokViews)}</strong>
          </div>
          <div>
            Instagram 送信率（送信÷届いた人数）<strong>{pct(stat.igReelSends, stat.igReelReach)}</strong>
          </div>
          <div>
            Instagram リンク率（タップ÷訪問）<strong>{pct(stat.igLinkTaps, stat.igProfileVisits)}</strong>
          </div>
        </div>

        <div className={styles.subHead}>これまでの週</div>
        {pastStats.length === 0 ? (
          <div className={styles.note}>まだ過去の記録はありません</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>週（月曜）</th>
                  <th>TikTok再生</th>
                  <th>保存</th>
                  <th>保存率</th>
                  <th>検索%</th>
                  <th>IG送信</th>
                  <th>届いた人</th>
                  <th>送信率</th>
                  <th>訪問</th>
                  <th>タップ</th>
                  <th>リンク率</th>
                  <th>メモ</th>
                </tr>
              </thead>
              <tbody>
                {pastStats.map((s) => (
                  <tr key={s.weekStart}>
                    <td>{s.weekStart}</td>
                    <td>{fmtNum(s.tiktokViews)}</td>
                    <td>{fmtNum(s.tiktokSaves)}</td>
                    <td>{pct(s.tiktokSaves, s.tiktokViews)}</td>
                    <td>{s.tiktokSearchPct == null ? "—" : `${s.tiktokSearchPct}%`}</td>
                    <td>{fmtNum(s.igReelSends)}</td>
                    <td>{fmtNum(s.igReelReach)}</td>
                    <td>{pct(s.igReelSends, s.igReelReach)}</td>
                    <td>{fmtNum(s.igProfileVisits)}</td>
                    <td>{fmtNum(s.igLinkTaps)}</td>
                    <td>{pct(s.igLinkTaps, s.igProfileVisits)}</td>
                    <td className={styles.memoCell}>{s.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 週の方針 */}
      <section className={styles.card}>
        <h3 className={styles.h3}>週の方針（決めること）</h3>
        <div className={styles.grid2}>
          <label className={styles.label}>
            TikTok 投稿/週
            <NumField label="TikTok 投稿/週" value={data.tiktokPerWeek} step="1" onChange={(v) => update({ tiktokPerWeek: num(v, 0) })} />
          </label>
          <label className={styles.label}>
            うち動画
            <NumField label="TikTok うち動画" value={data.tiktokVideoPerWeek} step="1" onChange={(v) => update({ tiktokVideoPerWeek: num(v, 0) })} />
          </label>
          <label className={styles.label}>
            Instagram フィード・リール/週
            <NumField label="Instagram フィード・リール/週" value={data.igFeedPerWeek} step="1" onChange={(v) => update({ igFeedPerWeek: num(v, 0) })} />
          </label>
          <label className={styles.label}>
            うちリール
            <NumField label="Instagram うちリール" value={data.igReelPerWeek} step="1" onChange={(v) => update({ igReelPerWeek: num(v, 0) })} />
          </label>
          <label className={styles.label}>
            ストーリーズ/日
            <NumField label="ストーリーズ/日" value={data.igStoryPerDay} step="1" onChange={(v) => update({ igStoryPerDay: num(v, 0) })} />
          </label>
          <label className={styles.label}>
            投稿する時間
            <input className={styles.input} type="text" value={data.postTime} onChange={(e) => update({ postTime: e.target.value })} />
          </label>
          <label className={styles.label}>
            休みの曜日
            <select className={styles.input} value={data.restDay} onChange={(e) => update({ restDay: e.target.value })}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.subHead}>投稿の内容（使うものにチェック）</div>
        <ul className={styles.checks}>
          {data.contentTypes.map((c) => (
            <li key={c.id}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) =>
                    update({
                      contentTypes: data.contentTypes.map((x) => (x.id === c.id ? { ...x, enabled: e.target.checked } : x)),
                    })
                  }
                />
                <span>
                  <strong>{c.label}</strong>
                  <span className={styles.dim}>（{c.desc}）</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className={styles.subHead}>検索キーワード</div>
        <div className={styles.note}>1投稿に1つ。1枚目の文字・文章の最初・声に入れる</div>
        <ul className={styles.kwList}>
          {data.keywords.map((k, i) => (
            <li key={k + i} className={styles.kw}>
              <span>{k}</span>
              <button
                type="button"
                className={styles.del}
                aria-label={`${k}を削除`}
                onClick={() => update({ keywords: data.keywords.filter((_, j) => j !== i) })}
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

      {/* コピー用テンプレート */}
      <section className={styles.card}>
        <h3 className={styles.h3}>コピー用テンプレート</h3>
        {TEMPLATES.map((t, i) => (
          <div key={t.title} className={styles.tpl}>
            <div className={styles.tplTitle}>{t.title}</div>
            <div className={styles.tplText}>{t.text}</div>
            <button type="button" className={styles.secondary} onClick={() => copy(i, t.text)}>
              {copied === i ? "コピーしました" : "コピー"}
            </button>
          </div>
        ))}
      </section>

      {/* なぜこうするか */}
      <section className={styles.card}>
        <details className={styles.details}>
          <summary className={styles.summary}>なぜこうするか</summary>
          <ul className={styles.why}>
            {WHY.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
