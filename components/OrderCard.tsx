"use client";

import { Order, OrderStatus, Settings, nextStatus } from "@/lib/types";
import { formatDate } from "@/lib/storage";
import { effectivePrice, elapsedDays, formatYen, isOverdue } from "@/lib/pricing";
import styles from "./OrderCard.module.css";

interface Props {
  order: Order;
  settings: Settings;
  avgDays: number | null;
  onClick: () => void;
  onAdvance: () => void;
}

// Record<OrderStatus, ...> にして、ステータスを追加したときの対応漏れを型で検知する。
const statusClass: Record<OrderStatus, string> = {
  "受信トレイ": styles.sInbox,
  "問い合わせ中": styles.sInquiry,
  "制作中": styles.sMaking,
  "支払い待ち": styles.sUnpaid,
  "発送待ち": styles.sShipping,
  "完了": styles.sDone,
  "失注": styles.sLost,
};

export default function OrderCard({
  order,
  settings,
  avgDays,
  onClick,
  onAdvance,
}: Props) {
  const isInbox = order.status === "受信トレイ";
  const overdue = isOverdue(order, avgDays);
  const designDisplay =
    order.design && order.design.length > 32
      ? order.design.slice(0, 32) + "…"
      : order.design;
  const price = effectivePrice(settings, order);
  const next = nextStatus(order.status);

  // カードはクリックで詳細を開く。中に「次へ」ボタンを置くため、ネスト不可な
  // <button> ではなく role="button" の <div> にしてキーボード操作も担保する。
  return (
    <div
      role="button"
      tabIndex={0}
      className={`${styles.card} ${isInbox ? styles.inbox : ""} ${overdue ? styles.overdue : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        // カード本体上のキー操作だけ拾う。内側の「次へ」ボタン由来の
        // Enter/Space が bubble してモーダルを同時に開くのを防ぐ。
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className={styles.topRow}>
        <span className={styles.customer}>
          {order.source === "instagram" && (
            <span className={styles.igBadge}>📷 IG</span>
          )}
          {order.customer || order.igUsername || "（未入力）"}
          {order.igUsername &&
            order.customer &&
            order.igUsername !== order.customer && (
              <span className={styles.igHandle}>{order.igUsername}</span>
            )}
          {order.igUsernameHistory && order.igUsernameHistory.length > 0 && (
            <span className={styles.igRenamed} title="ユーザーネーム変更あり">
              改名
            </span>
          )}
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
        {next && (
          <button
            type="button"
            className={styles.advanceBtn}
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
            title={`「${next}」に進める`}
          >
            {next} →
          </button>
        )}
      </div>
    </div>
  );
}
