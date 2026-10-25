"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Coupon = {
  id: string;
  code: string;
  kindLabel: string;
  source: "admin" | "line" | "purchase";
  note: string;
  percentOff: number | null;
  createdAt: number;
  status: "unused" | "reserved" | "used" | "disabled";
  redeemedAt: number | null;
  usedVia: "ec" | "order" | null;
  usedBy: string | null;
};

function statusOf(c: Coupon): { label: string; cls: string } {
  if (c.status === "used") {
    return {
      ...STATUS.used,
      label: c.usedVia === "order" ? "使用済み（オーダー）" : "使用済み（EC）",
    };
  }
  return STATUS[c.status];
}

const NOT_USABLE: Record<Exclude<Coupon["status"], "unused">, string> = {
  reserved: "ECの決済の手続き中のため、いまは使用済みにできません",
  used: "すでに使用済みです",
  disabled: "無効になっているため使えません",
};

const STATUS: Record<Coupon["status"], { label: string; cls: string }> = {
  unused: {
    label: "未使用",
    cls: "border-emerald-700/40 bg-emerald-700/10 text-emerald-800",
  },
  reserved: {
    label: "決済中",
    cls: "border-amber-700/40 bg-amber-700/10 text-amber-800",
  },
  used: {
    label: "使用済み",
    cls: "border-border bg-muted text-muted-foreground",
  },
  disabled: {
    label: "無効",
    cls: "border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 text-[var(--accent-red)]",
  },
};

export function CouponManager({
  initial,
  loadError,
}: {
  initial: Coupon[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Coupon | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<Coupon | null>(null);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [using, setUsing] = useState(false);
  const codeRef = useRef<HTMLButtonElement>(null);

  async function issue() {
    setIssuing(true);
    setError(null);
    setCopied(null);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        coupon?: Coupon;
        error?: string;
      };
      if (!res.ok || !body.coupon) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setIssued(body.coupon);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "発行に失敗しました");
    } finally {
      setIssuing(false);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("ok");
    } catch {
      // コピーできない環境では、コードを選択状態にして手動コピーしてもらう
      const el = codeRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopied("fail");
    }
  }

  async function copyListed(c: Coupon) {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId((cur) => (cur === c.id ? null : cur)), 2000);
    } catch {
      window.prompt("コードを長押ししてコピーしてください", c.code);
    }
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setFound(null);
    setSearchMsg(null);
    try {
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(q)}`);
      const body = (await res.json().catch(() => ({}))) as { coupon?: Coupon; error?: string };
      if (res.status === 404 || res.status === 400) {
        setSearchMsg("見つかりません。コードを確かめてください");
      } else if (!res.ok || !body.coupon) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      } else {
        setFound(body.coupon);
      }
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : "検索に失敗しました");
    } finally {
      setSearching(false);
    }
  }

  async function redeemByOrder(c: Coupon) {
    if (!window.confirm(`${c.code} をオーダーで使用済みにします。元に戻せません。`)) return;
    setUsing(true);
    setSearchMsg(null);
    try {
      const res = await fetch(`/api/admin/coupons/${encodeURIComponent(c.code)}/use`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { coupon?: Coupon; error?: string };
      if (!res.ok) {
        setSearchMsg(body.error ?? `HTTP ${res.status}`);
        // 状態が変わっていることがあるので最新を引き直す
        await search();
        setSearchMsg(body.error ?? null);
        return;
      }
      if (body.coupon) setFound(body.coupon);
      router.refresh();
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : "使用済みにできませんでした");
    } finally {
      setUsing(false);
    }
  }

  async function disable(c: Coupon) {
    if (!window.confirm(`${c.code} を無効にします。元には戻せません。`)) return;
    setBusyId(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      if (issued?.id === c.id) setIssued(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "無効化に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <section className="rounded-xl border border-border bg-white/60 p-4 sm:p-5">
        <h2 className="text-base font-medium">コードを調べる（DMで受け取ったコード）</h2>
        <form onSubmit={search} className="mt-2 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="740-XXXXXX"
            aria-label="クーポンコード"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            className="min-h-12 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 font-mono text-base"
          />
          <button
            type="submit"
            disabled={searching || !query.trim() || Boolean(loadError)}
            className="min-h-12 shrink-0 rounded-full bg-foreground px-6 text-base font-medium text-background disabled:opacity-50"
          >
            {searching ? "検索中…" : "調べる"}
          </button>
        </form>
        {searchMsg ? (
          <p role="alert" className="mt-3 text-base text-[var(--accent-red)]">
            {searchMsg}
          </p>
        ) : null}
        {found ? (
          <div className="mt-4 rounded-xl border border-foreground bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="break-all font-mono text-xl font-bold tracking-wide">
                {found.code}
              </span>
              <span
                className={`inline-block shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-base font-medium ${statusOf(found).cls}`}
              >
                {statusOf(found).label}
              </span>
            </div>
            <p className="mt-2 text-base font-medium">{found.kindLabel}</p>
            <p className="mt-2 text-base text-muted-foreground">
              発行 {formatDate(found.createdAt)}
              {found.status === "used"
                ? ` ・ 使用 ${found.redeemedAt ? formatDate(found.redeemedAt) : "日時不明"}`
                : ""}
            </p>
            {found.status === "unused" ? (
              <button
                type="button"
                onClick={() => redeemByOrder(found)}
                disabled={using}
                className="mt-4 min-h-14 w-full rounded-full bg-foreground px-6 text-base font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {using ? "処理中…" : "オーダーで使用済みにする"}
              </button>
            ) : (
              <p className="mt-3 text-base text-muted-foreground">{NOT_USABLE[found.status]}</p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-white/60 p-4 sm:p-5">
        <label htmlFor="coupon-note" className="block text-base font-medium">
          渡す相手・メモ（任意）
        </label>
        <input
          id="coupon-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="例: 11/22 ポップアップ ○○さん"
          disabled={issuing}
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
        />
        <button
          type="button"
          onClick={issue}
          disabled={issuing || Boolean(loadError)}
          className="mt-4 min-h-14 w-full rounded-full bg-foreground px-6 text-base font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {issuing ? "発行中…" : "クーポンを発行する"}
        </button>

        {error ? (
          <p role="alert" className="mt-3 text-base text-[var(--accent-red)]">
            {error}
          </p>
        ) : null}
        {loadError ? (
          <p role="alert" className="mt-3 text-base text-[var(--accent-red)]">
            {loadError}
          </p>
        ) : null}

        {issued ? (
          <div className="mt-5 rounded-xl border border-foreground bg-background p-4 text-center">
            <p className="text-base text-muted-foreground">
              発行しました（全商品{issued.percentOff ?? ""}%オフ・1回だけ）
            </p>
            <button
              ref={codeRef}
              type="button"
              onClick={() => copy(issued.code)}
              className="mt-2 block w-full select-all break-all py-2 font-mono text-3xl font-bold tracking-wider sm:text-4xl"
              aria-label={`コード ${issued.code}。タップでコピー`}
            >
              {issued.code}
            </button>
            {issued.note ? (
              <p className="mt-1 break-words text-base text-muted-foreground">
                {issued.note}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => copy(issued.code)}
              className="mt-3 min-h-12 w-full rounded-full border border-foreground px-6 text-base font-medium transition hover:bg-foreground hover:text-background"
            >
              コードをコピー
            </button>
            <p
              role="status"
              className="mt-2 min-h-6 text-base text-muted-foreground"
            >
              {copied === "ok"
                ? "コピーしました"
                : copied === "fail"
                  ? "コピーできませんでした。選択したコードを長押ししてコピーしてください"
                  : ""}
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-base font-medium uppercase tracking-[0.2em] text-muted-foreground">
          発行済み（{initial.length}）
        </h2>
        {initial.length === 0 ? (
          <div className="mt-3 rounded-xl border border-border bg-white/60 p-8 text-center text-base text-muted-foreground">
            まだ発行していません。
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {initial.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-border bg-white/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="break-all font-mono text-xl font-bold tracking-wide">
                    {c.code}
                  </span>
                  <span
                    className={`inline-block shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-base font-medium ${statusOf(c).cls}`}
                  >
                    {statusOf(c).label}
                  </span>
                </div>
                <p className="mt-2 text-base font-medium">{c.kindLabel}</p>
                {c.note ? (
                  <p className="mt-1 break-words text-base">{c.note}</p>
                ) : null}
                <p className="mt-2 text-base text-muted-foreground">
                  発行 {formatDate(c.createdAt)}
                  {c.status === "used"
                    ? ` ・ 使用 ${c.redeemedAt ? formatDate(c.redeemedAt) : "日時不明"}`
                    : ""}
                </p>
                {c.status === "unused" ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => copyListed(c)}
                      className="min-h-11 flex-1 rounded-full border border-border px-4 text-base transition hover:bg-muted/50"
                    >
                      {copiedId === c.id ? "コピーしました" : "コピー"}
                    </button>
                    <button
                      type="button"
                      onClick={() => disable(c)}
                      disabled={busyId === c.id}
                      className="min-h-11 flex-1 rounded-full border border-[var(--accent-red)]/50 px-4 text-base text-[var(--accent-red)] transition hover:bg-[var(--accent-red)]/10 disabled:opacity-50"
                    >
                      {busyId === c.id ? "処理中…" : "無効にする"}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// サーバー(UTC)とブラウザで表示がずれないよう、日本時間に固定する。
const dateFmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(ms: number): string {
  return dateFmt.format(new Date(ms));
}
