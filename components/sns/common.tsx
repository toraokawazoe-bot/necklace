"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../SnsPlan.module.css";

// 数字入力。入力途中の文字列はここで持ち、確定した数だけ親に返す。
export function NumField({
  value,
  onChange,
  label,
  step,
  placeholder,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  step?: string;
  placeholder?: string;
  className?: string;
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
      className={`${styles.input} ${className ?? ""}`}
      type="number"
      inputMode="decimal"
      step={step ?? "any"}
      min="0"
      aria-label={label}
      placeholder={placeholder}
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

// 入力を止めてから少し待って1回だけ保存する数字入力(投稿ごとの再生数・保存数など)
export function DebouncedNum({
  value,
  onSave,
  label,
  placeholder,
  className,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ v: number | null } | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) saveRef.current(pending.current.v);
    },
    []
  );
  return (
    <NumField
      label={label}
      placeholder={placeholder}
      className={className}
      value={value}
      step="1"
      onChange={(v) => {
        pending.current = { v };
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          const p = pending.current;
          pending.current = null;
          if (p) saveRef.current(p.v);
        }, 800);
      }}
    />
  );
}

export function Bar({
  label,
  done,
  target,
  note,
  warn,
}: {
  label: string;
  done: number;
  target: number;
  note?: string;
  warn?: boolean;
}) {
  const ratio = target > 0 ? Math.min(1, done / target) : 0;
  return (
    <div className={styles.barRow}>
      <div className={styles.barHead}>
        <span>{label}</span>
        <span className={`${styles.barNum} ${warn ? styles.warnText : ""}`}>
          {done}/{target}
        </span>
      </div>
      <div className={styles.barTrack} role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={done} aria-label={label}>
        <div className={`${styles.barFill} ${warn ? styles.barWarn : ""}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

// 「コピー」ボタン。押すと少しの間「コピーしました」になる。
export function CopyButton({ text, label = "コピー", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className ?? styles.secondary}
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } else {
          alert("コピーできませんでした。長押しで選んでコピーしてください。");
        }
      }}
    >
      {done ? "コピーしました" : label}
    </button>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  render,
}: {
  options: T[];
  value: T | "";
  onChange: (v: T) => void;
  label: string;
  render?: (v: T) => string;
}) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={`${styles.chip} ${value === o ? styles.chipOn : ""}`}
          aria-pressed={value === o}
          onClick={() => onChange(o)}
        >
          {render ? render(o) : o}
        </button>
      ))}
    </div>
  );
}
