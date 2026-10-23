import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";
import { listAbandoned } from "@/lib/abandoned";
import {
  END_LABEL,
  STAGE_LABEL,
  deriveEnd,
  deriveStage,
  methodLabel,
  summarize,
  type AbandonedRecord,
  type StageKey,
  type Tally,
} from "@/lib/abandoned-core";
import { BackfillButton } from "@/components/admin/BackfillButton";
import { formatJPY } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 管理者(ログイン必須)だけが見る。メールなどの個人情報を含むので、公開ページ・ログには出さない。
export default async function AbandonedPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  let records: AbandonedRecord[] = [];
  let loadError: string | null = null;
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    loadError = "Redis(Upstash)が未設定です。";
  } else {
    try {
      records = await listAbandoned(300);
    } catch (e) {
      console.error("[admin/abandoned] list failed:", e);
      loadError = "一覧を取得できませんでした。時間をおいて開き直してください。";
    }
  }
  const stopped = records.filter((r) => r.outcome !== "paid");
  const open = stopped.filter((r) => r.outcome === "open");
  const closed = stopped.filter((r) => r.outcome !== "open");
  const sum = summarize(closed);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
          <Link href="/admin" className="inline-flex min-h-11 items-center hover:text-foreground">
            ← Admin
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-serif tracking-tight sm:text-3xl">止まった決済</h1>
        <p className="mt-1 text-base text-muted-foreground">
          決済画面まで来て、払わずに終わったものを1件ずつ。どこまで進んだか・なぜ止まったかを Stripe の記録から読み取っています。
        </p>
      </header>

      {loadError ? (
        <div className="mt-8 rounded-xl border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/5 p-5 text-sm">
          {loadError}
        </div>
      ) : null}

      <section className="mt-6 rounded-xl border border-border bg-white/60 p-5">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          過去分の取り込み
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          この機能を入れる前に止まった決済は、押すと Stripe から読み直して反映します(Stripe は読むだけで、何も変更しません)。
          「戻るボタンか放置か」はStripeが持つ過去30日分のイベントから判定します。端末・流入元は過去分では分かりません。
        </p>
        <div className="mt-3">
          <BackfillButton />
        </div>
      </section>

      {closed.length === 0 && !loadError ? (
        <div className="mt-8 rounded-xl border border-border bg-white/60 p-8 text-center text-sm text-muted-foreground">
          まだ記録がありません。上の「過去分を Stripe から再取得」を押してください。
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="止まった決済" value={sum.total} sub={open.length ? `ほかに決済画面を開いている最中 ${open.length}` : undefined} />
            <Stat
              label="支払いまで試した"
              value={sum.attemptedCount}
              sub={`${pct(sum.attemptedCount, sum.total)}`}
            />
            <Stat
              label="メールまで入力"
              value={sum.emailEnteredCount}
              sub={`${pct(sum.emailEnteredCount, sum.total)}`}
            />
            <Stat
              label="カードのみで作り直し"
              value={sum.cardOnlyCount}
              sub="PayPayが使えなかった画面"
            />
          </section>

          <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Panel title="どこまで進んだか">
              <Bars rows={sum.byStage} total={sum.total} />
            </Panel>
            <Panel title="終わり方">
              <Bars rows={sum.byEnd} total={sum.total} />
            </Panel>
            <Panel title="失敗の理由(支払いを試した分)">
              <Bars
                rows={sum.byReason}
                total={Math.max(1, sum.byReason.reduce((a, r) => a + r.count, 0))}
                empty="支払いを試して失敗した記録はありません"
              />
            </Panel>
            <Panel title="支払方法(最後に選んだもの)">
              <Bars rows={sum.byMethod} total={sum.total} />
            </Panel>
            <Panel title="端末(記録開始後の分のみ)">
              <Bars rows={sum.byApp} total={sum.total} />
              <div className="mt-4">
                <Bars rows={sum.byDevice} total={sum.total} />
              </div>
            </Panel>
            <Panel title="流入元(記録開始後の分のみ)">
              <Bars rows={sum.byReferrer} total={sum.total} />
            </Panel>
          </section>

          {sum.repeatPeople.length > 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              同じメールで繰り返し:{" "}
              {sum.repeatPeople.map((p) => `${p.email.slice(0, 2)}***(${p.count}回)`).join("、")}
            </p>
          ) : null}

          <section className="mt-10">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              1件ずつ
            </h2>
            <ul className="mt-4 space-y-3">
              {[...open, ...closed].map((r) => (
                <Row key={r.sessionId} r={r} />
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function pct(n: number, t: number): string {
  return t ? `${Math.round((n / t) * 100)}%` : "—";
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/60 p-4 sm:p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">{value.toLocaleString()}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white/60 p-5">
      <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Bars({ rows, total, empty }: { rows: Tally; total: number; empty?: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty ?? "記録がありません"}</p>;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 break-words">{r.key}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.count}件 ({pct(r.count, total)})
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-foreground" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const STAGE_CLS: Record<StageKey, string> = {
  paid: "border-emerald-700/40 bg-emerald-700/10 text-emerald-800",
  viewed_only: "border-border bg-muted text-muted-foreground",
  email: "border-amber-700/40 bg-amber-700/10 text-amber-800",
  address: "border-amber-700/40 bg-amber-700/10 text-amber-800",
  attempt_started: "border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 text-[var(--accent-red)]",
  paypay_left: "border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 text-[var(--accent-red)]",
  attempt_failed: "border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 text-[var(--accent-red)]",
};

function Row({ r }: { r: AbandonedRecord }) {
  const stage = deriveStage(r);
  const end = deriveEnd(r);
  const failed = r.attempts.filter((a) => !a.ok);
  const mins =
    r.endedAt && r.endedAt > r.createdAt ? Math.round((r.endedAt - r.createdAt) / 60000) : null;
  return (
    <li className="rounded-xl border border-border bg-white/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
        <span
          className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${STAGE_CLS[stage]}`}
        >
          {r.outcome === "open" ? "決済画面を開いている最中 / " : ""}
          {STAGE_LABEL[stage]}
        </span>
        <span className="text-xs text-muted-foreground">
          {r.outcome === "open" ? "まだ閉じていない" : END_LABEL[end]}
          {mins !== null ? `(開いてから ${mins} 分)` : ""}
        </span>
        <span className="ml-auto whitespace-nowrap text-sm font-medium tabular-nums">
          {formatJPY(r.amount)}
        </span>
      </div>

      <div className="mt-2 text-sm">
        {r.items.length
          ? r.items.map((it, i) => (
              <span key={i}>
                {i > 0 ? "、" : ""}
                {it.name}
                {it.size ? ` ${it.size}` : ""}
                {it.qty > 1 ? ` ×${it.qty}` : ""}
              </span>
            ))
          : "—"}
        {r.couponCode ? (
          <span className="ml-2 text-xs text-muted-foreground">
            クーポン {r.couponCode}
            {r.discountAmount ? ` −${formatJPY(r.discountAmount)}` : ""}
          </span>
        ) : null}
      </div>

      {failed.length > 0 ? (
        <ul className="mt-3 space-y-1.5 rounded-lg bg-muted/50 p-3 text-xs">
          {failed.map((a, i) => (
            <li key={i}>
              <span className="text-muted-foreground">{formatTime(a.at)} </span>
              <span className="font-medium">{methodLabel(a.method)}</span>
              {a.cardBrand ? (
                <span className="text-muted-foreground">
                  {" "}
                  ({a.cardBrand}
                  {a.cardFunding ? `/${a.cardFunding}` : ""}
                  {a.cardCountry ? `/${a.cardCountry}` : ""})
                </span>
              ) : null}
              : {a.reasonJa}
              {a.threeDS ? <span className="text-muted-foreground"> / 3DS {a.threeDS}</span> : null}
              {a.riskLevel && a.riskLevel !== "normal" ? (
                <span className="text-muted-foreground"> / Radar {a.riskLevel}</span>
              ) : null}
              {a.message ? (
                <div className="mt-0.5 break-words text-muted-foreground">原文: {a.message}</div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : r.paymentIntentId ? (
        <p className="mt-3 text-xs text-muted-foreground">
          支払い手続きは始まったが、失敗の記録はなし(
          {r.payMethod ? methodLabel(r.payMethod) : "支払方法は不明"}
          {r.piStatus ? ` / 状態 ${r.piStatus}` : ""}
          {r.piCancellation ? ` / ${r.piCancellation}` : ""}
          )。{r.payMethod === "paypay" ? "PayPayの画面へ移動して、戻らなかった可能性があります。" : ""}
        </p>
      ) : null}

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <div>
          <dt className="inline">入力: </dt>
          <dd className="inline">
            {[
              r.progress.email ? "メール" : null,
              r.progress.name ? "氏名" : null,
              r.progress.phone ? "電話" : null,
              r.progress.address ? "住所" : null,
            ]
              .filter(Boolean)
              .join("・") || "なし"}
          </dd>
        </div>
        <div>
          <dt className="inline">画面の支払方法: </dt>
          <dd className="inline">
            {r.methodsOffered.map(methodLabel).join(" + ") || "—"}
            {r.cardOnly ? "(PayPayが無い画面)" : ""}
          </dd>
        </div>
        {r.device ? (
          <div>
            <dt className="inline">端末: </dt>
            <dd className="inline">
              {r.device.os} / {r.device.app}
              {r.device.inApp ? "(アプリ内ブラウザ)" : ""}
            </dd>
          </div>
        ) : null}
        {r.referrer ? (
          <div>
            <dt className="inline">流入元: </dt>
            <dd className="inline">{r.referrer}</dd>
          </div>
        ) : null}
        {r.email ? (
          <div>
            <dt className="inline">メール: </dt>
            <dd className="inline">{r.email}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

function formatDate(ms: number): string {
  // サーバーの時刻帯に関係なく日本時間で出す
  const jst = new Date(ms + 9 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}

function formatTime(ms: number): string {
  const jst = new Date(ms + 9 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}
