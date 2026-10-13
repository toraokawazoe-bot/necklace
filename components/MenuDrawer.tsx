"use client";

import { useEffect, useRef } from "react";
import styles from "./MenuDrawer.module.css";

export type Tab = "orders" | "sales" | "sns" | "settings";

const ITEMS: { value: Tab; label: string; hint?: string }[] = [
  { value: "orders", label: "注文" },
  { value: "sales", label: "売上", hint: "月ごとの売上履歴" },
  { value: "sns", label: "SNS運用" },
  { value: "settings", label: "設定", hint: "価格・バックアップ" },
];

const LS_KEY = "necklace_last_tab";

// 前回開いていたタブ。売上・設定はモーダルなので記憶するのは注文／SNS運用のみ。
export function loadTab(): Tab {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "orders" || v === "sns") return v;
  } catch {
    /* localStorage が使えなくても注文タブで動く */
  }
  return "orders";
}

export function saveTab(t: Tab): void {
  try {
    localStorage.setItem(LS_KEY, t);
  } catch {
    /* 無視 */
  }
}

interface Props {
  open: boolean;
  current: Tab;
  onSelect: (t: Tab) => void;
  onClose: () => void;
}

export default function MenuDrawer({ open, current, onSelect, onClose }: Props) {
  const firstRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    firstRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <nav
        className={styles.drawer}
        aria-label="メニュー"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.title}>メニュー</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="メニューを閉じる">
            ×
          </button>
        </div>
        <ul className={styles.list}>
          {ITEMS.map((it, i) => (
            <li key={it.value}>
              <button
                ref={i === 0 ? firstRef : undefined}
                type="button"
                className={`${styles.item} ${current === it.value ? styles.active : ""}`}
                aria-current={current === it.value ? "page" : undefined}
                onClick={() => onSelect(it.value)}
              >
                <span>{it.label}</span>
                {it.hint && <span className={styles.hint}>{it.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
