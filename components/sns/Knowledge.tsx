"use client";

import { useState } from "react";
import { KNOWLEDGE } from "@/lib/snsKnowledge";
import styles from "../SnsPlan.module.css";

interface Props {
  onMake: (formatId: string) => void;
}

export default function Knowledge({ onMake }: Props) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const query = q.trim().toLowerCase();

  const sections = KNOWLEDGE.filter((s) => cat === "all" || s.id === cat)
    .map((s) => ({
      ...s,
      items: query
        ? s.items.filter((it) => `${s.title} ${it.title ?? ""} ${it.body}`.toLowerCase().indexOf(query) !== -1)
        : s.items,
    }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      <section className={styles.card}>
        <div className={styles.searchWrap}>
          <input
            className={styles.input}
            type="search"
            inputMode="search"
            placeholder="ナレッジを検索(例:1枚目、ハッシュタグ、クリスマス)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className={styles.chips} role="group" aria-label="カテゴリ">
          <button
            type="button"
            className={`${styles.chip} ${styles.chipSmall} ${cat === "all" ? styles.chipOn : ""}`}
            aria-pressed={cat === "all"}
            onClick={() => setCat("all")}
          >
            すべて
          </button>
          {KNOWLEDGE.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.chip} ${styles.chipSmall} ${cat === s.id ? styles.chipOn : ""}`}
              aria-pressed={cat === s.id}
              onClick={() => setCat(s.id)}
            >
              {s.title.replace(/\(.*\)$/, "")}
            </button>
          ))}
        </div>
      </section>

      {sections.length === 0 && <div className={styles.note}>「{q}」に当てはまるものはありません</div>}

      {sections.map((s) => (
        <section key={s.id} className={styles.card}>
          <h3 className={styles.h3}>{s.title}</h3>
          <ul className={styles.list}>
            {s.items.map((it, i) => (
              <li key={i} className={styles.listItemCol}>
                {it.title && <strong>{it.title}</strong>}
                <div className={styles.kbody}>{it.body}</div>
                {it.formatId && (
                  <button type="button" className={styles.linkBtn} onClick={() => onMake(it.formatId as string)}>
                    この型で作る ›
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
