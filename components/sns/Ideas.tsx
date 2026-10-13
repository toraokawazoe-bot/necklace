"use client";

import { useRef, useState } from "react";
import { SNS_IDEA_STATUSES, SnsEffort, SnsIdea, SnsIdeaStatus } from "@/lib/types";
import { addIdea, deleteIdea, fmtDate, getIdeaImage, updateIdea } from "@/lib/sns";
import { compressImage } from "@/lib/image";
import { FORMAT_CARDS, findFormat } from "@/lib/snsKnowledge";
import ShareSetup from "./ShareSetup";
import type { CreatePreset } from "./Create";
import styles from "../SnsPlan.module.css";

interface Props {
  ideas: SnsIdea[];
  onMake: (p: Omit<CreatePreset, "nonce">) => void;
}

type Filter = SnsIdeaStatus | "すべて";
const FILTERS: Filter[] = ["未仕分け", "採用", "投稿済み", "却下", "すべて"];
const SCORES = [1, 2, 3, 4, 5];
const EFFORTS: Exclude<SnsEffort, "">[] = ["S", "M", "L"];
const ACTIVE_LIMIT = 30;

function score(i: SnsIdea): number | null {
  return i.impact && i.ease ? i.impact * i.ease : null;
}

export default function Ideas({ ideas, onMake }: Props) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [filter, setFilter] = useState<Filter>("未仕分け");
  const [openId, setOpenId] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, string | null>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  if (showSetup) return <ShareSetup onClose={() => setShowSetup(false)} />;

  // 未仕分け+採用が30件を超えたら、古いものを却下候補にする
  const active = ideas.filter((i) => i.status === "未仕分け" || i.status === "採用");
  const staleIds: Record<string, true> = {};
  active.slice(ACTIVE_LIMIT).forEach((i) => (staleIds[i.id] = true));

  const counts: Record<string, number> = { すべて: ideas.length };
  for (const i of ideas) counts[i.status] = (counts[i.status] ?? 0) + 1;
  const list = filter === "すべて" ? ideas : ideas.filter((i) => i.status === filter);

  const onPick = async (f: File | undefined) => {
    if (!f) return;
    setImgBusy(true);
    try {
      setImage(await compressImage(f));
    } catch (e) {
      console.error("compress failed", e);
      alert("画像を読み込めませんでした。別の画像でお試しください。");
    } finally {
      setImgBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    const t = text.trim();
    const u = url.trim();
    if (!t && !u && !image) return;
    if (u && !/^https?:\/\//i.test(u)) {
      alert("参考URLは http:// か https:// で始まるものを入れてください。");
      return;
    }
    setBusy(true);
    try {
      await addIdea({ text: t, url: u || undefined, image: image ?? undefined });
      setText("");
      setUrl("");
      setImage(null);
      setFilter("未仕分け");
    } catch (e) {
      console.error("add idea failed", e);
      alert("入れられませんでした。通信状況を確認してもう一度お試しください。");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (i: SnsIdea, p: Partial<SnsIdea>) => {
    try {
      await updateIdea(i.id, p);
    } catch (e) {
      console.error("update idea failed", e);
      alert("保存できませんでした。通信状況を確認してもう一度お試しください。");
    }
  };

  const remove = async (i: SnsIdea) => {
    if (!confirm("このアイデアを削除しますか?")) return;
    try {
      await deleteIdea(i);
    } catch (e) {
      console.error("delete idea failed", e);
      alert("削除できませんでした。");
    }
  };

  const showImage = async (id: string) => {
    if (images[id] !== undefined) {
      setImages((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
      return;
    }
    try {
      const d = await getIdeaImage(id);
      setImages((m) => ({ ...m, [id]: d }));
    } catch (e) {
      console.error("load image failed", e);
      alert("スクショを読み込めませんでした。");
    }
  };

  return (
    <>
      <section className={styles.card}>
        <h3 className={styles.h3}>アイデアを入れる</h3>
        <input
          className={styles.input}
          type="text"
          placeholder="1行メモ(例:白T+黄色の差し色で撮る)"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
        />
        <input
          className={styles.input}
          type="url"
          inputMode="url"
          placeholder="参考URL(なくてもOK)"
          value={url}
          maxLength={1000}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className={styles.addRow}>
          <label className={styles.secondary + " " + styles.fileBtn}>
            {imgBusy ? "読み込み中…" : image ? "スクショを変える" : "スクショ"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className={styles.visuallyHidden}
              onChange={(e) => onPick(e.target.files?.[0])}
            />
          </label>
          <button type="button" className={styles.primary + " " + styles.grow} onClick={submit} disabled={busy || imgBusy || (!text.trim() && !url.trim() && !image)}>
            {busy ? "入れています…" : "アイデア箱に入れる"}
          </button>
        </div>
        {image && (
          <div className={styles.thumbRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="選んだスクショ" className={styles.thumb} />
            <button type="button" className={styles.del} onClick={() => setImage(null)}>
              外す
            </button>
          </div>
        )}
        <button type="button" className={styles.linkBtn} onClick={() => setShowSetup(true)}>
          iPhoneの共有ボタンから送る設定 ›
        </button>
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>アイデア箱</h3>
        <div className={styles.note}>週1回の仕分け:影響(1〜5)×手軽さ(1〜5)。16点以上は採用の候補、9点以下は却下の候補。</div>
        <div className={styles.chips} role="group" aria-label="状態で絞る">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles.chip} ${filter === f ? styles.chipOn : ""}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f} {counts[f] ?? 0}
            </button>
          ))}
        </div>
        {active.length > ACTIVE_LIMIT && (
          <div className={styles.warnBox}>未仕分け・採用が{active.length}件あります。古い{active.length - ACTIVE_LIMIT}件を却下候補にしています。</div>
        )}

        {list.length === 0 && <div className={styles.note}>ここにはまだありません</div>}
        <ul className={styles.list}>
          {list.map((i) => {
            const sc = score(i);
            const open = openId === i.id;
            const fmt = findFormat(i.formatId);
            const scoreCls = sc == null ? "" : sc >= 16 ? styles.scoreGood : sc <= 9 ? styles.scoreBad : "";
            return (
              <li key={i.id} className={`${styles.ideaItem} ${scoreCls} ${staleIds[i.id] ? styles.stale : ""}`}>
                <button type="button" className={styles.ideaHead} onClick={() => setOpenId(open ? null : i.id)} aria-expanded={open}>
                  <span className={styles.ideaText}>{i.text || i.url || "(スクショのみ)"}</span>
                  <span className={styles.ideaMeta}>
                    {fmtDate(i.created)}
                    {i.source === "ios-share" ? "・共有ボタン" : ""}
                    {i.status !== "未仕分け" ? `・${i.status}` : ""}
                    {fmt ? `・${fmt.name}` : ""}
                    {i.effort ? `・手間${i.effort}` : ""}
                    {sc != null ? `・${sc}点` : ""}
                    {sc != null && sc >= 16 ? "(採用候補)" : sc != null && sc <= 9 ? "(却下候補)" : ""}
                    {staleIds[i.id] ? "・古いので却下候補" : ""}
                    {i.hasImage ? "・📷" : ""}
                  </span>
                </button>
                {open && (
                  <div className={styles.ideaBody}>
                    <label className={styles.label}>
                      メモ
                      <input
                        className={styles.input}
                        type="text"
                        defaultValue={i.text}
                        maxLength={500}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== i.text) patch(i, { text: v });
                        }}
                      />
                    </label>
                    {i.url && (
                      <a className={styles.urlLink} href={i.url} target="_blank" rel="noopener noreferrer">
                        {i.url}
                      </a>
                    )}
                    {i.hasImage && (
                      <>
                        <button type="button" className={styles.secondary} onClick={() => showImage(i.id)}>
                          {images[i.id] !== undefined ? "スクショを閉じる" : "スクショを見る"}
                        </button>
                        {images[i.id] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={images[i.id] as string} alt="アイデアのスクショ" className={styles.shot} />
                        )}
                        {images[i.id] === null && <div className={styles.note}>スクショが見つかりませんでした</div>}
                      </>
                    )}

                    <div className={styles.fieldTitle}>影響(1〜5)</div>
                    <div className={styles.chips} role="group" aria-label="影響">
                      {SCORES.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`${styles.chip} ${styles.chipNum} ${i.impact === n ? styles.chipOn : ""}`}
                          aria-pressed={i.impact === n}
                          onClick={() => patch(i, { impact: n })}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className={styles.fieldTitle}>手軽さ(1〜5)</div>
                    <div className={styles.chips} role="group" aria-label="手軽さ">
                      {SCORES.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`${styles.chip} ${styles.chipNum} ${i.ease === n ? styles.chipOn : ""}`}
                          aria-pressed={i.ease === n}
                          onClick={() => patch(i, { ease: n })}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {sc != null && (
                      <div className={styles.dim}>
                        {i.impact}×{i.ease}={sc}点{sc >= 16 ? " → 採用の候補" : sc <= 9 ? " → 却下の候補" : ""}
                      </div>
                    )}

                    <label className={styles.label}>
                      型
                      <select className={styles.input} value={i.formatId ?? ""} onChange={(e) => patch(i, { formatId: e.target.value || undefined })}>
                        <option value="">(まだ決めない)</option>
                        {FORMAT_CARDS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.star ? "★" : ""}
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.label}>
                      季節
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="例:冬・クリスマス"
                        defaultValue={i.season ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (i.season ?? "")) patch(i, { season: v });
                        }}
                      />
                    </label>
                    <div className={styles.fieldTitle}>手間</div>
                    <div className={styles.chips} role="group" aria-label="手間">
                      {EFFORTS.map((ef) => (
                        <button
                          key={ef}
                          type="button"
                          className={`${styles.chip} ${styles.chipNum} ${i.effort === ef ? styles.chipOn : ""}`}
                          aria-pressed={i.effort === ef}
                          onClick={() => patch(i, { effort: i.effort === ef ? "" : ef })}
                        >
                          {ef}
                        </button>
                      ))}
                    </div>

                    <div className={styles.fieldTitle}>状態</div>
                    <div className={styles.chips} role="group" aria-label="状態">
                      {SNS_IDEA_STATUSES.map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={`${styles.chip} ${i.status === st ? styles.chipOn : ""}`}
                          aria-pressed={i.status === st}
                          onClick={() => patch(i, { status: st })}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <div className={styles.addRow}>
                      {i.status !== "投稿済み" && i.status !== "却下" && (
                        <button
                          type="button"
                          className={styles.primary + " " + styles.grow}
                          onClick={async () => {
                            if (i.status === "未仕分け") await patch(i, { status: "採用" });
                            onMake({ ideaId: i.id, formatId: i.formatId });
                          }}
                        >
                          {i.status === "採用" ? "作る" : "採用して作る"}
                        </button>
                      )}
                      <button type="button" className={styles.del} onClick={() => remove(i)}>
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
