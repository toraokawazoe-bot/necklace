import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { readSnapshot, type AnalyticsSnapshot } from "@/lib/analytics";
import { readOrderStats, type StoredOrder } from "@/lib/orders";
import { formatJPY } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const [data, orders] = await Promise.all([
    readSnapshot(14),
    readOrderStats(30),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            740NLL
          </p>
          <h1 className="mt-1 text-3xl font-serif tracking-tight">Admin · Analytics</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{session.email}</span>
          <form action="/api/admin/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-border px-4 py-1.5 text-sm transition hover:bg-foreground hover:text-background"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      {!data.configured ? (
        <div className="mt-10 rounded-xl border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/5 p-6 text-sm">
          <p className="font-medium">Upstash Redis が未設定です。</p>
          <p className="mt-1 text-muted-foreground">
            <code>UPSTASH_REDIS_REST_URL</code> / <code>UPSTASH_REDIS_REST_TOKEN</code>{" "}
            を設定すると自作の計測データが表示されます。Vercel Analytics
            のグラフはこちら →{" "}
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Vercel Dashboard
            </a>
          </p>
        </div>
      ) : null}

      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="累計 売上" value={formatJPY(orders.revenueTotal)} accent />
        <Stat
          label="注文数"
          value={orders.paidCount.toLocaleString()}
          sub={
            orders.failedCount + orders.expiredCount > 0
              ? `失敗/期限切れ ${orders.failedCount + orders.expiredCount}`
              : undefined
          }
        />
        <Stat label="累計 PV" value={data.totals.pv.toLocaleString()} />
        <Stat label="累計 ユニーク" value={data.totals.uv.toLocaleString()} />
      </section>

      <section className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="今日 PV" value={data.today.pv.toLocaleString()} sub={data.today.date} />
        <Stat label="今日 ユニーク" value={data.today.uv.toLocaleString()} sub={data.today.date} />
        <Stat
          label="CVR (今日)"
          value={
            data.today.uv > 0
              ? `${((conversionToday(data.today.uv, orders) ?? 0) * 100).toFixed(1)}%`
              : "—"
          }
          sub="参考値"
        />
        <Stat
          label="平均注文単価"
          value={
            orders.paidCount > 0
              ? formatJPY(Math.round(orders.revenueTotal / orders.paidCount))
              : "—"
          }
        />
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            最近の注文
          </h2>
          <span className="text-xs text-muted-foreground">
            最新 {orders.recent.length} 件
          </span>
        </div>
        <OrdersTable orders={orders.recent} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          直近14日間
        </h2>
        <DailyChart daily={data.daily} />
      </section>

      <section className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
        <Panel title="流入元 (累計)">
          <RankList
            rows={data.topReferrers}
            keyOf={(r) => r.source}
            labelOf={(r) => r.source}
            valueOf={(r) => r.count}
            empty="まだ記録がありません"
          />
        </Panel>
        <Panel title="流入元 (今日)">
          <RankList
            rows={data.todayReferrers}
            keyOf={(r) => r.source}
            labelOf={(r) => r.source}
            valueOf={(r) => r.count}
            empty="今日はまだ記録がありません"
          />
        </Panel>
        <Panel title="人気ページ (累計)">
          <RankList
            rows={data.topPaths}
            keyOf={(r) => r.path}
            labelOf={(r) => r.path}
            valueOf={(r) => r.count}
            empty="まだ記録がありません"
            mono
          />
        </Panel>
        <Panel title="Vercel Analytics">
          <p className="text-sm text-muted-foreground">
            国・デバイス・正確なリアルタイム値などはこちら。
          </p>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-full border border-foreground px-4 py-1.5 text-sm transition hover:bg-foreground hover:text-background"
          >
            Vercel Dashboard を開く
          </a>
        </Panel>
      </section>

      <footer className="mt-16 flex justify-between text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          ← サイトへ戻る
        </Link>
        <span>計測対象は /admin 以外のページです。</span>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-white/60"
      }`}
    >
      <p
        className={`text-xs uppercase tracking-[0.18em] ${
          accent ? "text-background/70" : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl tracking-tight">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub ? (
        <p
          className={`mt-1 text-xs ${
            accent ? "text-background/70" : "text-muted-foreground"
          }`}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function conversionToday(
  todayUv: number,
  orders: { paidCount: number; recent: StoredOrder[] },
): number | null {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPaid = orders.recent.filter(
    (o) =>
      o.status === "paid" &&
      new Date(o.createdAt).toISOString().slice(0, 10) === todayStr,
  ).length;
  if (todayUv === 0) return null;
  return todayPaid / todayUv;
}

function OrdersTable({ orders }: { orders: StoredOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-white/60 p-8 text-center text-sm text-muted-foreground">
        まだ注文がありません。
      </div>
    );
  }
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-white/60">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">日時</th>
            <th className="px-4 py-3 text-left font-medium">状態</th>
            <th className="px-4 py-3 text-left font-medium">お客様</th>
            <th className="px-4 py-3 text-left font-medium">商品</th>
            <th className="px-4 py-3 text-right font-medium">金額</th>
            <th className="px-4 py-3 text-left font-medium">配送先</th>
            <th className="px-4 py-3 text-left font-medium">支払</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((o) => (
            <tr key={o.sessionId} className="hover:bg-muted/30">
              <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(o.createdAt)}
              </td>
              <td className="px-4 py-3 align-top">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-4 py-3 align-top">
                {o.customerName ? (
                  <div className="font-medium">{o.customerName}</div>
                ) : null}
                {o.email ? (
                  <div className="text-xs text-muted-foreground">{o.email}</div>
                ) : null}
                {!o.customerName && !o.email ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : null}
              </td>
              <td className="px-4 py-3 align-top">
                {o.items.length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <ul className="space-y-1.5">
                    {o.items.map((it, i) => {
                      const parsed = parseItemName(it.name);
                      return (
                        <li key={i} className="leading-tight">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium">
                              {parsed.name}
                            </span>
                            {parsed.size ? (
                              <span className="rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {parsed.size}
                              </span>
                            ) : null}
                            {it.qty > 1 ? (
                              <span className="text-xs text-muted-foreground">
                                × {it.qty}
                              </span>
                            ) : null}
                          </div>
                          {parsed.subtitle ? (
                            <div className="text-[11px] text-muted-foreground">
                              {parsed.subtitle}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3 align-top text-right font-medium tabular-nums">
                {o.amountTotal > 0 ? formatJPY(o.amountTotal) : "—"}
              </td>
              <td className="px-4 py-3 align-top text-xs">
                {o.shippingSummary ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 align-top text-xs">
                {o.paymentMethod ?? <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: StoredOrder["status"] }) {
  const map: Record<StoredOrder["status"], { label: string; cls: string }> = {
    paid: {
      label: "決済済",
      cls: "border-emerald-700/40 bg-emerald-700/10 text-emerald-800",
    },
    refunded: {
      label: "返金済",
      cls: "border-amber-700/40 bg-amber-700/10 text-amber-800",
    },
    failed: {
      label: "失敗",
      cls: "border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 text-[var(--accent-red)]",
    },
    expired: {
      label: "期限切れ",
      cls: "border-border bg-muted text-muted-foreground",
    },
  };
  const meta = map[status];
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

function parseItemName(raw: string): {
  name: string;
  subtitle: string | null;
  size: string | null;
} {
  const sizeMatch = raw.match(/(\d{2})\s*cm/);
  const size = sizeMatch ? `${sizeMatch[1]}cm` : null;
  const withoutSize = size ? raw.replace(/[・·]?\s*\d{2}\s*cm.*$/, "").trim() : raw;
  const dashSplit = withoutSize.split(/\s+—\s+|\s+-\s+/);
  const name = dashSplit[0]?.trim() ?? withoutSize;
  const subtitle = dashSplit.slice(1).join(" — ").trim() || null;
  return { name, subtitle, size };
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white/60 p-5">
      <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function RankList<T>({
  rows,
  keyOf,
  labelOf,
  valueOf,
  empty,
  mono,
}: {
  rows: T[];
  keyOf: (r: T) => string;
  labelOf: (r: T) => string;
  valueOf: (r: T) => number;
  empty: string;
  mono?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  const max = Math.max(...rows.map(valueOf), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const v = valueOf(r);
        const pct = (v / max) * 100;
        return (
          <li key={keyOf(r)} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={`truncate ${mono ? "font-mono text-[13px]" : ""}`}
                title={labelOf(r)}
              >
                {labelOf(r)}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {v.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-foreground"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DailyChart({ daily }: { daily: AnalyticsSnapshot["daily"] }) {
  if (daily.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        まだデータがありません。
      </p>
    );
  }
  const max = Math.max(...daily.map((d) => d.pv), 1);
  return (
    <div className="mt-4 rounded-xl border border-border bg-white/60 p-5">
      <div className="flex items-end gap-1.5" style={{ height: 140 }}>
        {daily.map((d) => {
          const h = (d.pv / max) * 100;
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <div
                className="w-full rounded-t bg-foreground/85 transition group-hover:bg-foreground"
                style={{ height: `${h}%`, minHeight: d.pv > 0 ? 2 : 0 }}
                title={`${d.date} · PV ${d.pv} / UV ${d.uv}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{daily[0].date}</span>
        <span>{daily[daily.length - 1].date}</span>
      </div>
    </div>
  );
}
