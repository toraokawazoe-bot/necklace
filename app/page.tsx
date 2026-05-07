"use client";

import { useEffect, useState } from "react";
import { Order, OrderStatus } from "@/lib/types";
import {
  subscribeOrders,
  saveOrder,
  deleteOrder,
  mergeSeedOrders,
  createEmptyOrder,
} from "@/lib/storage";
import { SEED_ORDERS } from "@/lib/seedData";
import OrderCard from "@/components/OrderCard";
import OrderForm from "@/components/OrderForm";
import styles from "./page.module.css";

type Filter = "all" | OrderStatus;

const FILTERS: { label: string; value: Filter }[] = [
  { label: "すべて", value: "all" },
  { label: "📥 受信", value: "受信トレイ" },
  { label: "問い合わせ", value: "問い合わせ中" },
  { label: "制作中", value: "制作中" },
  { label: "支払い待ち", value: "支払い待ち" },
  { label: "発送待ち", value: "発送待ち" },
  { label: "完了", value: "完了" },
  { label: "失注", value: "失注" },
];

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Order | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    mergeSeedOrders(SEED_ORDERS).then(() => {
      unsubscribe = subscribeOrders((data) => {
        setOrders(data);
        setLoaded(true);
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleQuickAdd = async () => {
    const newOrder = createEmptyOrder();
    await saveOrder(newOrder);
    setEditing(newOrder);
  };

  const handleSave = async (order: Order) => {
    await saveOrder(order);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    await deleteOrder(id);
    setEditing(null);
  };

  const inboxCount = orders.filter((o) => o.status === "受信トレイ").length;
  const progressCount = orders.filter((o) =>
    ["問い合わせ中", "制作中", "支払い待ち", "発送待ち"].includes(o.status)
  ).length;

  const filtered =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "受信トレイ" && b.status !== "受信トレイ") return -1;
    if (b.status === "受信トレイ" && a.status !== "受信トレイ") return 1;
    return b.created - a.created;
  });

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>オーダー管理</h1>
        <span className={styles.count}>{orders.length}件</span>
      </header>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>受信トレイ</div>
          <div className={styles.statValue}>{inboxCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>進行中</div>
          <div className={styles.statValue}>{progressCount}</div>
        </div>
      </div>

      <button className={styles.addBtn} onClick={handleQuickAdd}>
        <span className={styles.addIcon}>📥</span>
        <span>DMきた（受信トレイに追加）</span>
      </button>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`${styles.filterBtn} ${filter === f.value ? styles.filterActive : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loaded && sorted.length === 0 && (
        <div className={styles.empty}>
          {orders.length === 0
            ? "DMがきたら上の「📥」ボタンから素早く記録してね"
            : "このステータスのオーダーはありません"}
        </div>
      )}

      <div className={styles.list}>
        {sorted.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onClick={() => setEditing(order)}
          />
        ))}
      </div>

      {editing && (
        <OrderForm
          order={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
