"use client";

import { useEffect, useMemo, useState } from "react";
import { EMPTY_SETTINGS, Order, OrderStatus, Settings, nextStatus } from "@/lib/types";
import {
  subscribeOrders,
  subscribeSettings,
  saveOrder,
  saveSettings,
  deleteOrder,
  mergeSeedOrdersOnce,
  migrateLegacyLocalOrders,
  migrateStatusesOnce,
  createEmptyOrder,
  backfillOrderNos,
  allocateOrderNo,
} from "@/lib/storage";
import { SEED_ORDERS } from "@/lib/seedData";
import {
  averagePaidDays,
  formatYen,
  isOverdue,
  monthKey,
  summarizeMonth,
} from "@/lib/pricing";
import { REQUIRE_AUTH, logout } from "@/lib/authClient";
import OrderCard from "@/components/OrderCard";
import OrderForm from "@/components/OrderForm";
import SettingsPanel from "@/components/Settings";
import SalesHistory from "@/components/SalesHistory";
import styles from "./page.module.css";

type Filter = "all" | OrderStatus;

const FILTERS: { label: string; value: Filter }[] = [
  { label: "すべて", value: "all" },
  { label: "問い合わせ中", value: "問い合わせ中" },
  { label: "受注確定", value: "受注確定" },
  { label: "制作中", value: "制作中" },
  { label: "制作済み", value: "制作済み" },
  { label: "配送中", value: "配送中" },
  { label: "納品", value: "納品" },
  { label: "失注", value: "失注" },
];

// 顧客名・現在/過去の@username・デザイン・メモ・種別・支払い・長さを横断検索する。
function matchesQuery(order: Order, q: string): boolean {
  if (!q) return true;
  const hay = [
    order.customer,
    order.igUsername,
    ...(order.igUsernameHistory?.map((h) => h.username) ?? []),
    order.design,
    order.memo,
    order.type,
    order.payment,
    order.length,
    order.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Order | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewMonthOffset, setViewMonthOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // 連打防止：DM追加が処理中の間、二重に空オーダーが作られないようにする。
  const [quickAdding, setQuickAdding] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");

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
      // 旧7ステータス→新6段階+失注への一度きりの移行。購読開始前に完了させ、
      // 一覧が旧ステータス文字列のまま一瞬表示される（フィルタ/色が対応しない）のを防ぐ。
      try {
        await migrateStatusesOnce();
      } catch (e) {
        console.error("status migration failed", e);
      }
      // シード投入が失敗（オフライン・権限エラー等）しても、購読開始まで到達せず
      // 画面が無言でロード中のまま固まらないよう、ここで遮断する。
      // 投入は一度きり（meta/seed フラグで制御）。削除/編集が次回以降も定着する。
      try {
        await mergeSeedOrdersOnce(SEED_ORDERS);
      } catch (e) {
        console.error("seed merge failed", e);
      }
      // 旧データへの受注通し番号の採番（初回のみ）。subscribe より前に await して
      // 完了させることで、UI 操作（新規追加の採番）が走る前にカウンタを確定させる。
      try {
        await backfillOrderNos();
      } catch (e) {
        console.error("orderNo backfill failed", e);
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
    // 初期化（採番カウンタの確定）が終わる前は追加させない。ここを通すと
    // カウンタ未初期化のまま採番が走り、採番順が受注順とズレる恐れがある。
    // quickAdding は連打防止（処理中の二重タップで空オーダーが2件できるのを防ぐ）。
    if (!loaded || quickAdding) return;
    setQuickAdding(true);
    try {
      const newOrder = createEmptyOrder();
      // 受注順を一目で追えるよう、作成時に固定の通し番号を振る。採番できなくても
      // （カウンタ未初期化など）追加は止めず、番号は次回ロードの backfill が拾う。
      // undefined を代入すると Firestore が弾くので、数値が返ったときだけ入れる。
      try {
        const no = await allocateOrderNo();
        if (no != null) newOrder.orderNo = no;
      } catch (e) {
        console.error("allocateOrderNo failed", e);
      }
      await saveOrder(newOrder);
      setEditing(newOrder);
    } catch (e) {
      console.error("quick add failed", e);
      alert("追加に失敗しました。通信状況を確認してもう一度お試しください。");
    } finally {
      setQuickAdding(false);
    }
  };

  const handleSave = async (order: Order) => {
    try {
      await saveOrder(order);
      setEditing(null);
    } catch (e) {
      console.error("saveOrder failed", e);
      alert("保存に失敗しました。通信状況を確認してもう一度お試しください（画面はまだ編集中のままです）。");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOrder(id);
      setEditing(null);
    } catch (e) {
      console.error("deleteOrder failed", e);
      alert("削除に失敗しました。通信状況を確認してもう一度お試しください。");
    }
  };

  const handleSaveSettings = async (next: Settings) => {
    try {
      await saveSettings(next);
      setShowSettings(false);
    } catch (e) {
      console.error("saveSettings failed", e);
      alert("保存に失敗しました。通信状況を確認してもう一度お試しください（画面はまだ編集中のままです）。");
    }
  };

  // カードからステータスを1段階進める（モーダルを開かずに）。
  // 「受注確定」は前払い入金の確認＝売上計上＆着金日スタンプが走るため、誤タップ防止に確認を挟む。
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const handleAdvance = async (order: Order) => {
    // 連打防止：この注文の「次へ」が処理中の間は再実行しない。
    if (advancingId === order.id) return;
    const next = nextStatus(order.status);
    if (!next) return;
    if (
      next === "受注確定" &&
      !confirm("「受注確定」にすると入金確認として売上に計上されます。よろしいですか？")
    ) {
      return;
    }
    setAdvancingId(order.id);
    try {
      await saveOrder({ ...order, status: next });
    } catch (e) {
      console.error("advance status failed", e);
      alert("ステータス変更に失敗しました。通信状況を確認してもう一度お試しください。");
    } finally {
      setAdvancingId(null);
    }
  };

  // フィルタタブに出す件数（検索語があれば検索結果ベースで数える）。
  const countSource = useMemo(
    () => orders.filter((o) => matchesQuery(o, search.trim())),
    [orders, search]
  );
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = { all: countSource.length };
    for (const o of countSource) m[o.status] = (m[o.status] ?? 0) + 1;
    return m;
  }, [countSource]);

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

  const q = search.trim();
  const filtered = orders.filter(
    (o) => (filter === "all" || o.status === filter) && matchesQuery(o, q)
  );

  const sorted = [...filtered].sort((a, b) => {
    const aOver = isOverdue(a, avgDays) ? 1 : 0;
    const bOver = isOverdue(b, avgDays) ? 1 : 0;
    if (aOver !== bOver) return bOver - aOver;
    if (a.needsResponse && !b.needsResponse) return -1;
    if (b.needsResponse && !a.needsResponse) return 1;
    // 受注順（来た順）で作るので、同じ優先度の中では古い順＝先に来たものを上に。
    // created は orderNo と同じ並びになる（採番が created 昇順のため）。
    return a.created - b.created;
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
            title="閉じる"
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
            title="売上履歴"
          >
            📅
          </button>
          <button
            className={styles.settingsBtn}
            onClick={() => setShowSettings(true)}
            aria-label="設定"
            title="設定（価格・バックアップ・ステータスの説明）"
          >
            ⚙
          </button>
          {REQUIRE_AUTH && (
            <button
              className={styles.settingsBtn}
              onClick={() => logout()}
              aria-label="ログアウト"
              title="ログアウト"
            >
              🔓
            </button>
          )}
        </div>
      </header>

      <section className={styles.salesCard}>
        <div className={styles.salesNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => setViewMonthOffset((v) => v - 1)}
            aria-label="前の月"
            title="前の月"
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
            title="次の月"
            disabled={viewMonthOffset >= 0}
          >
            ›
          </button>
        </div>
        <div className={styles.salesGrid}>
          <div>
            <div className={styles.salesLabel}>受注金額</div>
            <div className={styles.salesValue}>{formatYen(summary.bookedAmount)}</div>
            <div className={styles.salesSub}>
              {summary.bookedCount}件
              {summary.bookedNoPriceCount > 0 && (
                <span className={styles.noPriceWarn}>
                  （うち{summary.bookedNoPriceCount}件 金額未設定）
                </span>
              )}
            </div>
          </div>
          <div>
            <div className={styles.salesLabel}>着金額</div>
            <div className={`${styles.salesValue} ${styles.salesPaid}`}>
              {formatYen(summary.paidAmount)}
            </div>
            <div className={styles.salesSub}>
              {summary.paidCount}件
              {summary.paidNoPriceCount > 0 && (
                <span className={styles.noPriceWarn}>
                  （うち{summary.paidNoPriceCount}件 金額未設定）
                </span>
              )}
            </div>
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

      <button
        className={styles.addBtn}
        onClick={handleQuickAdd}
        disabled={!loaded || quickAdding}
      >
        <span className={styles.addIcon}>📥</span>
        <span>{quickAdding ? "追加中…" : "DMきた（問い合わせ中に追加）"}</span>
      </button>

      <div className={styles.searchWrap}>
        <input
          className={styles.search}
          type="search"
          inputMode="search"
          placeholder="🔍 名前・@ID・デザイン・メモで検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => setSearch("")}
            aria-label="検索をクリア"
            title="検索をクリア"
          >
            ×
          </button>
        )}
      </div>

      <div className={styles.filters}>
        {FILTERS.map((f) => {
          const n = statusCounts[f.value] ?? 0;
          return (
            <button
              key={f.value}
              className={`${styles.filterBtn} ${filter === f.value ? styles.filterActive : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className={styles.filterCount}>{n}</span>
            </button>
          );
        })}
      </div>

      {q && (
        <div className={styles.searchHint}>
          「{q}」で絞り込み中：{filtered.length}件（タブの数字も検索結果ベース）
        </div>
      )}

      {loaded && sorted.length === 0 && (
        <div className={styles.empty}>
          {orders.length === 0
            ? "DMがきたら上の「📥」ボタンから素早く記録してね"
            : q
            ? "検索に一致するオーダーはありません"
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
            advancing={advancingId === order.id}
            onClick={() => setEditing(order)}
            onAdvance={() => handleAdvance(order)}
          />
        ))}
      </div>

      {editing && (
        <OrderForm
          order={editing}
          settings={settings}
          avgDays={avgDays}
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
