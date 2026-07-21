"use client";

import { useEffect, useMemo, useState } from "react";
import { Order, Settings } from "@/lib/types";
import { formatMonth, monthKey } from "@/lib/pricing";
import { exportBackup } from "@/lib/backup";
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
  // 未保存の変更があるかどうか。外側タップ／×／キャンセルで無警告に破棄しないためのガード。
  const dirty = JSON.stringify(rows) !== JSON.stringify(initialRows);
  const handleClose = () => {
    if (dirty && !confirm("保存していない変更があります。破棄して閉じますか？")) return;
    onClose();
  };

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
      alert(`${formatMonth(addMonth)}はすでに追加されています。上の表から金額を編集してください。`);
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
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>商品設定</h3>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="閉じる" title="閉じる">×</button>
        </div>

        <p className={styles.note}>
          月ごとの種別別デフォルト金額を設定。
          <br />
          オーダー詳細で個別に上書きすることもできます。
          <br />
          ※ここで金額を設定していない月の注文は、価格が未入力のままだと売上集計で¥0円として扱われます。新しい月が始まる前に必ず金額を追加してください。
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

        <label className={styles.label} htmlFor="settings-add-month">
          追加する月を選択（価格表に新しい月の行を追加します）
        </label>
        <div className={styles.addMonthRow}>
          <input
            id="settings-add-month"
            type="month"
            value={addMonth}
            onChange={(e) => setAddMonth(e.target.value)}
          />
          <button
            type="button"
            className={styles.addMonthBtn}
            onClick={handleAddMonth}
            disabled={!addMonth}
            title={!addMonth ? "先に左の欄で月を選んでください" : undefined}
          >
            月を追加
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSave}>保存</button>
          <button className={styles.cancelBtn} onClick={handleClose}>キャンセル</button>
        </div>

        <div className={styles.backupSection}>
          <div className={styles.backupHead}>データのバックアップ</div>
          <p className={styles.note}>
            注文{orders.length}件と価格設定を JSON で書き出して端末に控えを残します。
            <br />
            ※これは「書き出し」専用です（アプリからの自動復元は未対応。復元が必要なときは
            この JSON を保管のうえご相談ください）。
            <br />
            ※価格を変更した場合は、先に「保存」してからバックアップしてください。
            <br />
            ※スマホで新しいタブに JSON が開いた場合は、共有→「ファイルに保存」で保存できます。
          </p>
          <button
            type="button"
            className={styles.backupBtn}
            onClick={() => {
              const ok = exportBackup(orders, settings);
              alert(
                ok
                  ? "バックアップ用の JSON を書き出しました。"
                  : "書き出しに失敗しました。時間をおいて再度お試しください。"
              );
            }}
          >
            ⬇ バックアップを書き出す
          </button>
        </div>

        <div className={styles.backupSection}>
          <div className={styles.backupHead}>ステータスについて</div>
          <p className={styles.note}>
            問い合わせ中：DMが来て、まだ受注確定していない状態
            <br />
            受注確定：前払いの入金を確認した状態（ここで売上に計上されます）
            <br />
            制作中：制作に取りかかっている状態
            <br />
            制作済み：制作が完了し、まだ発送していない状態
            <br />
            配送中：発送済み、お届け中の状態
            <br />
            納品：お届けが完了した状態（この先には進みません）
            <br />
            失注：話が流れた・成立しなかった注文（上の6段階の流れとは別枠であつかいます）
          </p>
          <p className={styles.note}>
            受注#001など：受注した順に振られる通し番号
            <br />
            要対応：まだ内容を確認していない新着の問い合わせ（カードを開いて保存すると消えます）
            <br />
            改名：相手のInstagramのユーザーネームが変わったことがある印
            <br />
            ⏰N日経過：平均的な対応日数を超えていることの合図
          </p>
        </div>
      </div>
    </div>
  );
}
