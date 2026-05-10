import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { readSnapshot, type AnalyticsSnapshot } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const data = await readSnapshot(14);

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
        <Stat label="累計 PV" value={data.totals.pv} />
        <Stat label="累計 ユニーク" value={data.totals.uv} />
        <Stat label="今日 PV" value={data.today.pv} sub={data.today.date} />
        <Stat label="今日 ユニーク" value={data.today.uv} sub={data.today.date} />
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

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/60 p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl tracking-tight">
        {value.toLocaleString()}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
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
