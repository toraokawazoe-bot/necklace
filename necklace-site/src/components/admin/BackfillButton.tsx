"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Stripe の過去の期限切れセッションを読み直して保存する(読むだけ。1回で最大120件)。
export function BackfillButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/abandoned/backfill", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        scanned?: number;
        saved?: number;
        hasMore?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setMsg(data.error ?? "読み込みに失敗しました。");
        return;
      }
      setMsg(
        `${data.scanned ?? 0} 件を確認し、${data.saved ?? 0} 件を保存しました。${
          data.hasMore ? "これより古い分は取り込んでいません(新しい順に最大120件まで)。" : ""
        }`,
      );
      router.refresh();
    } catch {
      setMsg("通信に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="min-h-11 rounded-full border border-foreground px-5 py-2 text-sm transition hover:bg-foreground hover:text-background disabled:opacity-50"
      >
        {busy ? "Stripe から読み込み中…" : "過去分を Stripe から再取得"}
      </button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
