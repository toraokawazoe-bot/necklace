"use client";

import { Order, Settings } from "@/lib/types";
import { formatDate } from "@/lib/storage";
import { effectivePrice, elapsedDays, formatYen, isOverdue } from "@/lib/pricing";
import styles from "./OrderCard.module.css";

interface Props {
  order: Order;
  settings: Settings;
  avgDays: number | null;
  onClick: () => void;
}

const statusClass: Record<string, string> = {
  "受信トレイ": styles.sInbox,
  "問い合わせ中": styles.sInquiry,
  "制作中": styles.sMaking,
  "支払い待ち": styles.sUnpaid,
  "発送待ち": styles.sShipping,
  "完了": styles.sDone,
  "失注": styles.sLost,
};

export default function OrderCard({ order, settings, avgDays, onClick }: Props) {
  const isInbox = order.status === "受信トレイ";
  const overdue = isOverdue(order, avgDays);
  const designDisplay =
    order.design && order.design.length > 32
      ? order.design.slice(0, 32) + "…"
      : order.design;
  const price = effectivePrice(settings, order);

  return (
    <button
      className={`${styles.card} ${isInbox ? styles.inbox : ""} ${overdue ? styles.overdue : ""}`}
      onClick={onClick}
    >
      <div className={styles.topRow}>
        <span className={styles.customer}>
          {order.source === "instagram" && (
            <span className={styles.igBadge}>📷 IG</span>
          )}
          {order.customer || "（未入力）"}
        </span>
        <span className={`${styles.statusBadge} ${statusClass[order.status] || ""}`}>
          {order.status}
        </span>
      </div>

      {(order.type || order.design) && (
        <div className={styles.midRow}>
          {order.type && (
            <span
              className={`${styles.typeTag} ${
                order.type === "ネックレス" ? styles.typeNecklace : styles.typeBracelet
              }`}
            >
              {order.type}
            </span>
          )}
          {designDisplay && <span className={styles.design}>{designDisplay}</span>}
        </div>
      )}

      <div className={styles.bottomRow}>
        {order.length && <span>{order.length}cm</span>}
        {price !== undefined && (
          <span className={styles.price}>{formatYen(price)}</span>
        )}
        {order.payment && <span>{order.payment}</span>}
        <span>📅 {formatDate(order.created)}</span>
        {isInbox && <span className={styles.urgent}>要対応</span>}
        {overdue && (
          <span className={styles.reminder}>
            ⏰ {elapsedDays(order)}日経過
          </span>
        )}
      </div>
    </button>
  );
}
