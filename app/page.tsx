"use client";

import { useEffect, useMemo, useState } from "react";
import { EMPTY_SETTINGS, Order, OrderStatus, Settings } from "@/lib/types";
import {
  subscribeOrders,
  subscribeSettings,
  saveOrder,
  saveSettings,
  deleteOrder,
  mergeSeedOrdersOnce,
  migrateLegacyLocalOrders,
  createEmptyOrder,
} from "@/lib/storage";
import { SEED_ORDERS } from "@/lib/seedData";
import {
  averagePaidDays,
  formatYen,
  isOverdue,
  monthKey,
  summarizeMonth,
} from "@/lib/pricing";
import OrderCard from "@/components/OrderCard";
import OrderForm from "@/components/OrderForm";
import SettingsPanel from "@/components/Settings";
import SalesHistory from "@/components/SalesHistory";
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
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Order | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewMonthOffset, setViewMonthOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let unsubOrders: (() => void) | undefined;

    (async () => {
      try {
        const migrated = await migrateLegacyLocalOrders();
        if (migrated > 0) {
          setMigrationNotice(
            `この端末に保存されていた ${migrated} 件のオーダーをクラウドに復元しました`
          );
        }
      } catch (e) {
        console.error("legacy migration failed", e);
      }
      // シード投入が失敗（オフライン・権限エラー等）しても、購読開始まで到達せず
      // 画面が無言でロード中のまま固まらないよう、ここで遮断する。
      // 投入は一度きり（meta/seed フラグで制御）。削除/編集が次回以降も定着する。
      try {
        await mergeSeedOrdersOnce(SEED_ORDERS);
      } catch (e) {
        console.error("seed merge failed", e);
      }
      unsubOrders = subscribeOrders(
        (data) => {
          setOrders(data);
          setLoaded(true);
          setLoadError(false);
        },
        () => {
          // 購読が権限/ネット断で止まっても、空のまま無言で固まらないよう確定させる。
          setLoaded(true);
          setLoadError(true);
        }
      );
    })();

    const unsubSettings = subscribeSettings((s) => setSettings(s));

    return () => {
      unsubOrders?.();
      unsubSettings();
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

  const handleSaveSettings = async (next: Settings) => {
    await saveSettings(next);
    setShowSettings(false);
  };

  const inboxCount = orders.filter((o) => o.status === "受信トレイ").length;
  const progressCount = orders.filter((o) =>
    ["問い合わせ中", "制作中", "支払い待ち", "発送待ち"].includes(o.status)
  ).length;

  const viewedMonthDate = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth() + viewMonthOffset, 1);
  }, [viewMonthOffset]);
  const viewedMonthKey = monthKey(viewedMonthDate.getTime());
  const summary = useMemo(
    () => summarizeMonth(orders, settings, viewedMonthKey),
    [orders, settings, viewedMonthKey]
  );
  const viewedTitle =
    viewMonthOffset === 0
      ? "今月の売上"
      : viewMonthOffset === -1
      ? "先月の売上"
      : "売上";
  const avgDays = useMemo(() => averagePaidDays(orders), [orders]);
  const overdueCount = useMemo(
    () => orders.filter((o) => isOverdue(o, avgDays)).length,
    [orders, avgDays]
  );

  const filtered =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const sorted = [...filtered].sort((a, b) => {
    const aOver = isOverdue(a, avgDays) ? 1 : 0;
    const bOver = isOverdue(b, avgDays) ? 1 : 0;
    if (aOver !== bOver) return bOver - aOver;
    if (a.status === "受信トレイ" && b.status !== "受信トレイ") return -1;
    if (b.status === "受信トレイ" && a.status !== "受信トレイ") return 1;
    return b.created - a.created;
  });

  return (
    <main className={styles.main}>
      {migrationNotice && (
        <div className={styles.migrationNotice}>
          <span>✅ {migrationNotice}</span>
          <button
            type="button"
            onClick={() => setMigrationNotice(null)}
            aria-label="閉じる"
          >×</button>
        </div>
      )}
      {loadError && (
        <div className={styles.loadError}>
          <span>⚠️ データの読み込みに失敗しました。通信状況を確認して再読み込みしてください。</span>
        </div>
      )}
      <header className={styles.header}>
        <h1 className={styles.title}>オーダー管理</h1>
        <div className={styles.headerRight}>
          <span className={styles.count}>{orders.length}件</span>
          <button
            className={styles.settingsBtn}
            onClick={() => setShowHistory(true)}
            aria-label="売上履歴"
          >
            📅
          </button>
          <button
            className={styles.settingsBtn}
            onClick={() => setShowSettings(true)}
            aria-label="設定"
          >
            ⚙
          </button>
        </div>
      </header>

      <section className={styles.salesCard}>
        <div className={styles.salesNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setViewMonthOffset((v) => v - 1)}
            aria-label="前の月"
          >
            ‹
          </button>
          <div className={styles.salesHead}>
            <span className={styles.salesTitle}>{viewedTitle}</span>
            <span className={styles.salesMonth}>
              {viewedMonthDate.getFullYear()}年{viewedMonthDate.getMonth() + 1}月
            </span>
          </div>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setViewMonthOffset((v) => Math.min(0, v + 1))}
            aria-label="次の月"
            disabled={viewMonthOffset >= 0}
          >
            ›
          </button>
        </div>
        <div className={styles.salesGrid}>
          <div>
            <div className={styles.salesLabel}>受注金額</div>
            <div className={styles.salesValue}>{formatYen(summary.bookedAmount)}</div>
            <div className={styles.salesSub}>{summary.bookedCount}件</div>
          </div>
          <div>
            <div className={styles.salesLabel}>うち着金</div>
            <div className={`${styles.salesValue} ${styles.salesPaid}`}>
              {formatYen(summary.paidAmount)}
            </div>
            <div className={styles.salesSub}>{summary.paidCount}件</div>
          </div>
        </div>
        {avgDays !== null && (
          <div className={styles.salesMeta}>
            平均着金日数：{avgDays.toFixed(1)}日
            {overdueCount > 0 && (
              <span className={styles.overdueChip}>
                ⏰ 平均超過 {overdueCount}件
              </span>
            )}
          </div>
        )}
      </section>

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
            settings={settings}
            avgDays={avgDays}
            onClick={() => setEditing(order)}
          />
        ))}
      </div>

      {editing && (
        <OrderForm
          order={editing}
          settings={settings}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          settings={settings}
          orders={orders}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showHistory && (
        <SalesHistory
          orders={orders}
          settings={settings}
          onClose={() => setShowHistory(false)}
        />
      )}
    </main>
  );
}
