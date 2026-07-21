"use client";

import { Order, OrderStatus, Settings, nextStatus, carrierLabel } from "@/lib/types";
import { formatDate } from "@/lib/storage";
import { effectivePrice, elapsedDays, formatYen, isOverdue } from "@/lib/pricing";
import styles from "./OrderCard.module.css";

interface Props {
  order: Order;
  settings: Settings;
  avgDays: number | null;
  advancing?: boolean;
  onClick: () => void;
  onAdvance: () => void;
}

// Record<OrderStatus, ...> にして、ステータスを追加したときの対応漏れを型で検知する。
const statusClass: Record<OrderStatus, string> = {
  "問い合わせ中": styles.sInquiry,
  "受注確定": styles.sConfirmed,
  "制作中": styles.sMaking,
  "制作済み": styles.sMade,
  "配送中": styles.sShipping,
  "納品": styles.sDone,
  "失注": styles.sLost,
};

export default function OrderCard({
  order,
  settings,
  avgDays,
  advancing,
  onClick,
  onAdvance,
}: Props) {
  const isInbox = !!order.needsResponse;
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
          {order.orderNo != null && (
            <span className={styles.orderNo} title="受注番号（来た順）">
              受注#{String(order.orderNo).padStart(3, "0")}
            </span>
          )}
          {order.source === "instagram" && (
            <span className={styles.igBadge}>📷 IG</span>
          )}
          {order.customer || order.igUsername || "（未入力）"}
          {order.igUsername &&
            order.customer &&
            order.igUsername !== order.customer && (
              <span className={styles.igHandle}>{order.igUsername}</span>
            )}
        </span>
        {/* 省略表示（ellipsis）の対象外に固定し、名前が長くても改名警告が消えないようにする */}
        {order.igUsernameHistory && order.igUsernameHistory.length > 0 && (
          <span className={styles.igRenamed} title="ユーザーネーム変更あり">
            改名
          </span>
        )}
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
        {order.shippedAt && (
          <span className={styles.shipped}>
            📦 {formatDate(order.shippedAt)} 発送済
            {order.carrier ? `・${carrierLabel(order.carrier)}` : ""}
          </span>
        )}
        {next && (
          <button
            type="button"
            className={styles.advanceBtn}
            disabled={advancing}
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
            title={`「${next}」に進める`}
          >
            {advancing ? "処理中…" : `${next} →`}
          </button>
        )}
      </div>
    </div>
  );
}
