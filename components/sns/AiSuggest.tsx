"use client";

import { useEffect, useRef, useState } from "react";
import { getIdToken } from "@/lib/authClient";
import { resizeForAi } from "@/lib/image";
import { IG_HASHTAG_MAX, findFormat } from "@/lib/snsKnowledge";
import { CopyButton } from "./common";
import styles from "../SnsPlan.module.css";

// 「写真から提案」(docs/sns-spec.md §4)。AIは提案役。決めるのは人。
// 送るのは選んだ写真と商品欄の項目だけ。注文・お客さんのデータはこの画面から送らない。
// 写真は端末の中で縮小して送るだけで、どこにも保存しない(画面を離れると消える)。

const MAX_PHOTOS = 8;

interface Photo {
  key: string;
  dataUrl: string;
  base64: string;
}

interface Slide {
  image_index: number;
  role: string;
  reason: string;
  rule: string;
}

interface Suggestion {
  format_id: string;
  format_reason: string;
  slide_order: Slide[];
  missing_shots: string[];
  hook_candidates: { text: string; rule: string }[];
  caption: { tiktok: string; instagram: string };
  keyword: string;
  hashtags: { instagram: string[]; tiktok: string[] };
  checklist: { item: string; result: string; note: string }[];
  warnings: string[];
  confidence: string;
}

export interface AiApplied {
  formatId: string;
  hook: string;
  hookCandidates: string[];
  keyword: string;
}

interface Status {
  available: boolean;
  stopped: boolean;
  used: number | null;
  cap: number;
}

interface Props {
  noticeThisWeek: number;
  onApply: (a: AiApplied) => void;
}

export default function AiSuggest({ noticeThisWeek, onApply }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [product, setProduct] = useState({ color: "", material: "", length: "", price: "", oneLine: "" });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Suggestion | null>(null);
  const [sentPhotos, setSentPhotos] = useState<Photo[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [hooks, setHooks] = useState<string[]>([]);
  const [hookPick, setHookPick] = useState(0);
  const [capTiktok, setCapTiktok] = useState("");
  const [capIg, setCapIg] = useState("");
  const [applied, setApplied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const idToken = await getIdToken().catch(() => null);
        if (!idToken) {
          if (alive) setStatus({ available: false, stopped: false, used: null, cap: 20 });
          return;
        }
        const res = await fetch("/api/sns/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ action: "status" }),
          cache: "no-store",
        });
        const b = (await res.json().catch(() => ({}))) as Partial<Status> & { ok?: boolean };
        if (!alive) return;
        if (res.ok && b.ok) setStatus({ available: !!b.available, stopped: !!b.stopped, used: b.used ?? null, cap: b.cap ?? 20 });
        else setStatus({ available: false, stopped: false, used: null, cap: 20 });
      } catch {
        if (alive) setStatus({ available: false, stopped: false, used: null, cap: 20 });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length > room) alert(`写真は${MAX_PHOTOS}枚までです。先頭から${Math.max(0, room)}枚だけ入れます。`);
    setPreparing(true);
    try {
      const out: Photo[] = [];
      for (const f of list.slice(0, Math.max(0, room))) {
        try {
          const r = await resizeForAi(f);
          out.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ...r });
        } catch {
          alert(`「${f.name}」を読み込めませんでした。別の写真を選んでください。`);
        }
      }
      setPhotos((ps) => [...ps, ...out].slice(0, MAX_PHOTOS));
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = (key: string) => setPhotos((ps) => ps.filter((p) => p.key !== key));

  const disabledReason = !status
    ? "確認中…"
    : !status.available
    ? "AIは準備中です"
    : status.stopped
    ? "AIの無料枠の上限に達したため、今日はここまで。明日また使えます。"
    : status.used != null && status.used >= status.cap
    ? `今日はここまで(1日${status.cap}回まで)。明日また使えます。`
    : null;

  const canSend = !disabledReason && !loading && !preparing && photos.length > 0 && consent;

  const send = async () => {
    if (!canSend) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await getIdToken().catch(() => null);
      if (!idToken) {
        setError("ログインしてから使ってください。");
        return;
      }
      const res = await fetch("/api/sns/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          images: photos.map((p) => ({ data: p.base64 })),
          product,
          noticeThisWeek,
          consent: true,
        }),
        cache: "no-store",
      });
      const b = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        suggestion?: Suggestion;
        used?: number;
        cap?: number;
      };
      if (!res.ok || !b.ok || !b.suggestion) {
        setError(b.message ?? "うまく作れませんでした。もう一度押してください。");
        if (b.error === "quota" || b.error === "stopped") setStatus((s) => (s ? { ...s, stopped: true } : s));
        if (b.error === "day") setStatus((s) => (s ? { ...s, used: s.cap } : s));
        if (b.error === "not_configured") setStatus((s) => (s ? { ...s, available: false } : s));
        return;
      }
      const s = b.suggestion;
      setStatus((st) => (st ? { ...st, used: b.used ?? st.used } : st));
      setResult(s);
      setSentPhotos(photos);
      setSlides(s.slide_order);
      setHooks(s.hook_candidates.map((h) => h.text));
      setHookPick(0);
      setCapTiktok(s.caption.tiktok);
      setCapIg(s.caption.instagram);
      setApplied(false);
    } catch {
      setError("うまく作れませんでした。通信状況を確認して、もう一度押してください。");
    } finally {
      setLoading(false);
    }
  };

  const move = (i: number, d: -1 | 1) =>
    setSlides((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const n = xs.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const reset = () => {
    setResult(null);
    setSentPhotos([]);
    setSlides([]);
    setHooks([]);
    setPhotos([]);
    setConsent(false);
    setApplied(false);
    setError(null);
  };

  const fmt = result ? findFormat(result.format_id) : undefined;
  const igTags = result ? result.hashtags.instagram : [];
  const igTagCount = (capIg.match(/#[^\s#]+/g) ?? []).length + igTags.filter((t) => capIg.indexOf(t) === -1).length;
  const igFull = igTags.filter((t) => capIg.indexOf(t) === -1).length ? `${capIg}\n${igTags.filter((t) => capIg.indexOf(t) === -1).join(" ")}` : capIg;
  const ttTags = result ? result.hashtags.tiktok.filter((t) => capTiktok.indexOf(t) === -1) : [];
  const ttFull = ttTags.length ? `${capTiktok}\n${ttTags.join(" ")}` : capTiktok;

  return (
    <section className={styles.card}>
      <h3 className={styles.h3}>写真から提案(AI)</h3>
      <div className={styles.note}>
        写真を選ぶと、AIが型・並べ方・1枚目の文字・文章を提案します。決めるのは自分。並べ替え・書き換えは自由です。
        {status && status.available && status.used != null ? `(今日 ${status.used}/${status.cap}回)` : ""}
      </div>
      <div className={styles.warnBox} role="note">
        他の人の顔が写っている写真、お客さんの写真は入れないでください(無料のAIは内容が改善に使われます)
      </div>

      {!result && (
        <>
          <div className={styles.addRow}>
            <label className={`${styles.secondary} ${styles.fileBtn}`}>
              {preparing ? "読み込み中…" : `写真を選ぶ(${photos.length}/${MAX_PHOTOS})`}
              <input
                ref={fileRef}
                className={styles.visuallyHidden}
                type="file"
                accept="image/*"
                multiple
                disabled={preparing || photos.length >= MAX_PHOTOS}
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
          </div>
          {photos.length > 0 && (
            <div className={styles.aiPhotos}>
              {photos.map((p, i) => (
                <div key={p.key} className={styles.aiPhoto}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={`写真${i + 1}`} className={styles.thumb} />
                  <button type="button" className={styles.del} onClick={() => removePhoto(p.key)} aria-label={`写真${i + 1}を外す`}>
                    外す
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.fieldTitle}>商品の情報(分かるものだけ。空欄は【要入力】で返ります)</div>
          <div className={styles.grid2}>
            {(
              [
                ["color", "色"],
                ["material", "素材"],
                ["length", "長さ(cm)"],
                ["price", "値段(円)"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className={styles.label}>
                {label}
                <input
                  className={styles.input}
                  type="text"
                  maxLength={60}
                  value={product[k]}
                  onChange={(e) => setProduct((p) => ({ ...p, [k]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <label className={styles.label}>
            一言(なくてもOK)
            <input
              className={styles.input}
              type="text"
              maxLength={60}
              value={product.oneLine}
              onChange={(e) => setProduct((p) => ({ ...p, oneLine: e.target.value }))}
            />
          </label>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>この写真に、許可のない人は写っていません</span>
          </label>

          <button type="button" className={styles.primary} onClick={send} disabled={!canSend}>
            {loading ? "考え中…(30秒ほど)" : "写真から提案してもらう"}
          </button>
          {disabledReason && <div className={styles.note}>{disabledReason}</div>}
          {!disabledReason && photos.length === 0 && <div className={styles.note}>写真を1枚以上選んでください(8枚まで)</div>}
          {!disabledReason && photos.length > 0 && !consent && <div className={styles.note}>上の確認にチェックすると送れます</div>}
          {error && (
            <div className={styles.warnBox} role="alert">
              {error}
            </div>
          )}
        </>
      )}

      {result && (
        <>
          {result.warnings.length > 0 && (
            <div className={styles.warnBox}>
              <strong>注意</strong>
              <ul className={styles.plainList}>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.formatCard}>
            <div className={styles.formatName}>
              型:{fmt ? `${fmt.star ? "★" : ""}${fmt.name}` : result.format_id}
            </div>
            <div className={styles.dim}>{result.format_reason}</div>
            <div className={styles.dim}>確度:{result.confidence}</div>
          </div>

          <div className={styles.fieldTitle}>並べ方(▲▼で入れ替えできます)</div>
          <ol className={styles.list}>
            {slides.map((s, i) => {
              const p = sentPhotos[s.image_index];
              return (
                <li key={`${s.image_index}`} className={styles.aiSlide}>
                  <span className={styles.aiSlideNo}>{i + 1}</span>
                  {p && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={p.dataUrl} alt={`写真${s.image_index + 1}`} className={styles.thumb} />
                  )}
                  <div className={styles.grow}>
                    <div>
                      <strong>{s.role}</strong>
                      <span className={styles.dim}>({s.rule})</span>
                    </div>
                    <div className={styles.dim}>{s.reason}</div>
                  </div>
                  <div className={styles.aiMove}>
                    <button type="button" className={`${styles.chip} ${styles.chipSmall}`} onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ">
                      ▲
                    </button>
                    <button
                      type="button"
                      className={`${styles.chip} ${styles.chipSmall}`}
                      onClick={() => move(i, 1)}
                      disabled={i === slides.length - 1}
                      aria-label="下へ"
                    >
                      ▼
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          {result.missing_shots.length > 0 && (
            <>
              <div className={styles.fieldTitle}>足りない写真</div>
              <ul className={styles.plainList}>
                {result.missing_shots.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </>
          )}

          <div className={styles.fieldTitle}>1枚目の文字(1つ選ぶ・直してOK)</div>
          {hooks.map((h, i) => (
            <div key={i} className={styles.checkRow}>
              <input
                type="radio"
                name="ai-hook"
                checked={hookPick === i}
                onChange={() => setHookPick(i)}
                aria-label={`案${i + 1}を使う`}
              />
              <input
                className={`${styles.input} ${styles.grow}`}
                type="text"
                value={h}
                onChange={(e) => setHooks((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`1枚目の文字 案${i + 1}`}
              />
              <span className={styles.dim}>{result.hook_candidates[i]?.rule}</span>
            </div>
          ))}

          <div className={styles.fieldTitle}>キーワード:{result.keyword}</div>

          <label className={styles.label}>
            TikTokの文章(直してOK)
            <textarea className={`${styles.input} ${styles.output}`} rows={5} value={capTiktok} onChange={(e) => setCapTiktok(e.target.value)} />
          </label>
          <div className={styles.dim}>TikTokのハッシュタグ:{result.hashtags.tiktok.join(" ") || "なし"}</div>
          <CopyButton text={ttFull} label="TikTok用をコピー" />

          <label className={styles.label}>
            Instagramの文章(直してOK)
            <textarea className={`${styles.input} ${styles.output}`} rows={5} value={capIg} onChange={(e) => setCapIg(e.target.value)} />
          </label>
          <div className={igTagCount > IG_HASHTAG_MAX ? styles.warnBox : styles.dim}>
            Instagramのハッシュタグ:{igTags.join(" ") || "なし"}(合計{igTagCount}個/{IG_HASHTAG_MAX}個まで)
            {igTagCount > IG_HASHTAG_MAX ? " — 多すぎます。5個以内に減らしてください" : ""}
          </div>
          <CopyButton text={igFull} label="Instagram用をコピー" />

          <details className={styles.details}>
            <summary className={styles.summarySmall}>
              投稿前チェック(AIの見立て:OK {result.checklist.filter((c) => c.result === "OK").length}/{result.checklist.length})
            </summary>
            <ul className={styles.plainList}>
              {result.checklist.map((c, i) => (
                <li key={i}>
                  <span className={c.result === "NG" ? styles.warnText : c.result === "OK" ? styles.okText : styles.dim}>【{c.result}】</span>
                  {c.item}
                  {c.note ? <span className={styles.dim}>({c.note})</span> : null}
                </li>
              ))}
            </ul>
          </details>

          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              onApply({
                formatId: result.format_id,
                hook: (hooks[hookPick] ?? "").trim(),
                hookCandidates: hooks.map((h) => h.trim()),
                keyword: result.keyword,
              });
              setApplied(true);
            }}
          >
            この提案を下の「作る」に入れる
          </button>
          {applied && <div className={styles.okText}>入れました。下で確認して、投稿したら「投稿した!を記録」を押してください。</div>}
          <button type="button" className={styles.secondary} onClick={reset}>
            写真を選び直す
          </button>
        </>
      )}
    </section>
  );
}
