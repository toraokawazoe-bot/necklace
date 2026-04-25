"use client";

import { useEffect, useState } from "react";
import { Order, ItemType, PaymentMethod, OrderStatus, STATUS_LIST } from "@/lib/types";
import { formatDate } from "@/lib/storage";
import styles from "./OrderForm.module.css";

interface Props {
  order: Order;
  onSave: (order: Order) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function OrderForm({ order, onSave, onDelete, onClose }: Props) {
  const [customer, setCustomer] = useState(order.customer);
  const [type, setType] = useState<ItemType>(order.type);
  const [length, setLength] = useState(order.length);
  const [design, setDesign] = useState(order.design);
  const [payment, setPayment] = useState<PaymentMethod>(order.payment);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [memo, setMemo] = useState(order.memo);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSave = () => {
    onSave({
      ...order,
      customer: customer.trim(),
      type,
      length,
      design: design.trim(),
      payment,
      status,
      memo: memo.trim(),
    });
  };

  const handleDelete = () => {
    if (confirm("このオーダーを削除しますか？")) {
      onDelete(order.id);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>オーダー編集</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className={styles.dateInfo}>受注日：{formatDate(order.created)}</div>

        <div className={styles.field}>
          <label className={styles.label}>インスタID</label>
          <input
            type="text"
            placeholder="@username"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>種別</label>
          <div className={styles.typeGrid}>
            <button
              type="button"
              className={`${styles.typeBtn} ${type === "ネックレス" ? styles.active : ""}`}
              onClick={() => setType("ネックレス")}
            >
              ネックレス
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${type === "ブレスレット" ? styles.active : ""}`}
              onClick={() => setType("ブレスレット")}
            >
              ブレスレット
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>長さ (cm)</label>
          <input
            type="number"
            placeholder="40"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            inputMode="numeric"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>デザイン</label>
          <textarea
            placeholder="例：シルバー925、6mm丸玉、星チャーム、留め具カニカン"
            value={design}
            onChange={(e) => setDesign(e.target.value)}
            rows={4}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>支払い方法</label>
          <select value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)}>
            <option value="">未定</option>
            <option value="PayPay">PayPay</option>
            <option value="銀行振込">銀行振込</option>
            <option value="その他">その他</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ステータス</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>
                {s === "受信トレイ" ? "📥 " + s : s}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>メモ</label>
          <textarea
            placeholder="自由記入"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.saveBtn} onClick={handleSave}>保存</button>
          <button className={styles.cancelBtn} onClick={onClose}>キャンセル</button>
        </div>
        <button className={styles.deleteBtn} onClick={handleDelete}>このオーダーを削除</button>
      </div>
    </div>
  );
}
