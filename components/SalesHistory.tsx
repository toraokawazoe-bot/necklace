"use client";

import { useEffect, useMemo } from "react";
import { Order, Settings } from "@/lib/types";
import { formatMonth, formatYen, monthKey, summarizeMonth } from "@/lib/pricing";
import styles from "./SalesHistory.module.css";

interface Props {
  orders: Order[];
  settings: Settings;
  onClose: () => void;
}

export default function SalesHistory({ orders, settings, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const months = useMemo(() => {
    const keys = new Set<string>();
    for (const o of orders) {
      if (o.status === "失注") continue;
      keys.add(monthKey(o.created));
      if (o.paidAt) {
        keys.add(monthKey(o.paidAt));
      }
    }
    return Array.from(keys).sort();
  }, [orders]);

  const summaries = useMemo(
    () => months.map((k) => summarizeMonth(orders, settings, k)),
    [months, orders, settings]
  );

  const maxAmount = useMemo(
    () =>
      Math.max(
        1,
        ...summaries.map((s) => Math.max(s.bookedAmount, s.paidAmount))
      ),
    [summaries]
  );

  const totalBooked = summaries.reduce((sum, s) => sum + s.bookedAmount, 0);
  const totalPaid = summaries.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalBookedCount = summaries.reduce((sum, s) => sum + s.bookedCount, 0);
  const totalPaidCount = summaries.reduce((sum, s) => sum + s.paidCount, 0);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>売上履歴</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる">×</button>
        </div>

        {months.length === 0 ? (
          <div className={styles.empty}>まだ売上データがありません</div>
        ) : (
          <>
            <div className={styles.totals}>
              <div>
                <div className={styles.totalLabel}>累計 受注金額</div>
                <div className={styles.totalValue}>{formatYen(totalBooked)}</div>
                <div className={styles.totalSub}>{totalBookedCount}件 / {months.length}ヶ月</div>
              </div>
              <div>
                <div className={styles.totalLabel}>累計 着金</div>
                <div className={`${styles.totalValue} ${styles.totalPaid}`}>{formatYen(totalPaid)}</div>
                <div className={styles.totalSub}>{totalPaidCount}件</div>
              </div>
            </div>

            <div className={styles.chartWrap}>
              <div className={styles.chartTitle}>月別 受注金額の推移</div>
              <div className={styles.chartScroll}>
                <div
                  className={styles.chart}
                  style={{ minWidth: `${Math.max(summaries.length * 44, 280)}px` }}
                >
                  {summaries.map((s) => {
                    const bookedPct = s.bookedAmount > 0
                      ? Math.max(2, (s.bookedAmount / maxAmount) * 100)
                      : 0;
                    const paidPct = s.paidAmount > 0
                      ? Math.max(2, (s.paidAmount / maxAmount) * 100)
                      : 0;
                    const [, m] = s.monthKey.split("-");
                    return (
                      <div key={s.monthKey} className={styles.barCol}>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.bar}
                            style={{ height: `${bookedPct}%` }}
                            title={`${formatMonth(s.monthKey)} 受注${formatYen(s.bookedAmount)}`}
                          />
                          <div
                            className={styles.barPaid}
                            style={{ height: `${paidPct}%` }}
                            title={`${formatMonth(s.monthKey)} 着金${formatYen(s.paidAmount)}`}
                          />
                        </div>
                        <div className={styles.barLabel}>{Number(m)}月</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendBooked}`} />
                  受注金額
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.legendPaid}`} />
                  うち着金
                </span>
              </div>
            </div>

            <div className={styles.list}>
              {[...summaries].reverse().map((s) => (
                <div key={s.monthKey} className={styles.row}>
                  <div className={styles.rowMonth}>{formatMonth(s.monthKey)}</div>
                  <div className={styles.rowGrid}>
                    <div className={styles.rowCol}>
                      <div className={styles.rowLabel}>受注</div>
                      <div className={styles.rowValue}>{formatYen(s.bookedAmount)}</div>
                      <div className={styles.rowSub}>{s.bookedCount}件</div>
                    </div>
                    <div className={styles.rowCol}>
                      <div className={styles.rowLabel}>うち着金</div>
                      <div className={`${styles.rowValue} ${styles.rowPaid}`}>{formatYen(s.paidAmount)}</div>
                      <div className={styles.rowSub}>{s.paidCount}件</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
