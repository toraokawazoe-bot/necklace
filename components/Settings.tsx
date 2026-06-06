"use client";

import { useEffect, useMemo, useState } from "react";
import { Order, Settings } from "@/lib/types";
import { formatMonth, monthKey } from "@/lib/pricing";
import styles from "./Settings.module.css";

interface Props {
  settings: Settings;
  orders: Order[];
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

interface DraftRow {
  key: string;
  necklace: string;
  bracelet: string;
}

function toInputStr(n?: number): string {
  return typeof n === "number" ? String(n) : "";
}

export default function SettingsPanel({ settings, orders, onSave, onClose }: Props) {
  const initialRows = useMemo<DraftRow[]>(() => {
    const keys = new Set<string>();
    for (const o of orders) keys.add(monthKey(o.created));
    for (const k of Object.keys(settings.monthlyPrices)) keys.add(k);
    keys.add(monthKey(Date.now()));
    const sorted = Array.from(keys).sort((a, b) => (a < b ? 1 : -1));
    return sorted.map((k) => ({
      key: k,
      necklace: toInputStr(settings.monthlyPrices[k]?.necklace),
      bracelet: toInputStr(settings.monthlyPrices[k]?.bracelet),
    }));
  }, [settings, orders]);

  const [rows, setRows] = useState<DraftRow[]>(initialRows);
  const [addMonth, setAddMonth] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const updateRow = (idx: number, field: "necklace" | "bracelet", value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleAddMonth = () => {
    if (!addMonth) return;
    if (rows.some((r) => r.key === addMonth)) {
      setAddMonth("");
      return;
    }
    setRows((prev) =>
      [...prev, { key: addMonth, necklace: "", bracelet: "" }].sort((a, b) =>
        a.key < b.key ? 1 : -1
      )
    );
    setAddMonth("");
  };

  const handleSave = () => {
    const monthlyPrices: Record<string, { necklace?: number; bracelet?: number }> = {};
    for (const r of rows) {
      const n = r.necklace.trim() === "" ? undefined : Number(r.necklace);
      const b = r.bracelet.trim() === "" ? undefined : Number(r.bracelet);
      const entry: { necklace?: number; bracelet?: number } = {};
      if (typeof n === "number" && !Number.isNaN(n)) entry.necklace = n;
      if (typeof b === "number" && !Number.isNaN(b)) entry.bracelet = b;
      if (entry.necklace !== undefined || entry.bracelet !== undefined) {
        monthlyPrices[r.key] = entry;
      }
    }
    onSave({ monthlyPrices });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>商品設定</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <p className={styles.note}>
          月ごとの種別別デフォルト金額を設定。
          <br />
          オーダー詳細で個別に上書きすることもできます。
        </p>

        <div className={styles.tableWrap}>
          <div className={styles.tableHead}>
            <div className={styles.colMonth}>月</div>
            <div className={styles.colPrice}>ネックレス</div>
            <div className={styles.colPrice}>ブレスレット</div>
          </div>
          {rows.map((row, idx) => (
            <div key={row.key} className={styles.tableRow}>
              <div className={styles.colMonth}>{formatMonth(row.key)}</div>
              <div className={styles.colPrice}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={row.necklace}
                  onChange={(e) => updateRow(idx, "necklace", e.target.value)}
                />
              </div>
              <div className={styles.colPrice}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={row.bracelet}
                  onChange={(e) => updateRow(idx, "bracelet", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.addMonthRow}>
          <input
            type="month"
            value={addMonth}
            onChange={(e) => setAddMonth(e.target.value)}
          />
          <button
            type="button"
            className={styles.addMonthBtn}
            onClick={handleAddMonth}
            disabled={!addMonth}
          >
            月を追加
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSave}>保存</button>
          <button className={styles.cancelBtn} onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
