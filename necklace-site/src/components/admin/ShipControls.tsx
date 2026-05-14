"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CARRIERS = [
  { value: "japanpost_clickpost", label: "クリックポスト" },
  { value: "japanpost_yupacket", label: "ゆうパケット" },
  { value: "japanpost_yupack", label: "ゆうパック" },
  { value: "japanpost_letter", label: "定形外郵便（追跡なし）" },
  { value: "yamato", label: "ヤマト運輸" },
  { value: "sagawa", label: "佐川急便" },
  { value: "other", label: "その他" },
] as const;

type Props = {
  sessionId: string;
  shipped: boolean;
  shippedAt?: number;
  carrierLabel: string;
  trackingNumber?: string;
  trackingUrl?: string | null;
};

export function ShipControls(props: Props) {
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState<string>("japanpost_clickpost");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (props.shipped) {
    return (
      <div className="space-y-0.5 text-xs">
        <div className="inline-flex items-center gap-1 rounded-full border border-emerald-700/40 bg-emerald-700/10 px-2 py-0.5 font-medium text-emerald-800">
          発送済
        </div>
        <div className="text-[11px] text-muted-foreground">
          {props.carrierLabel}
        </div>
        {props.trackingNumber ? (
          <div className="text-[11px]">
            {props.trackingUrl ? (
              <a
                href={props.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {props.trackingNumber}
              </a>
            ) : (
              <span className="font-mono">{props.trackingNumber}</span>
            )}
          </div>
        ) : null}
        {props.shippedAt ? (
          <div className="text-[10px] text-muted-foreground">
            {formatDate(props.shippedAt)}
          </div>
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-foreground bg-foreground px-3 py-1 text-[11px] font-medium text-background transition hover:bg-foreground/80"
      >
        発送する
      </button>
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: props.sessionId,
          carrier,
          trackingNumber: trackingNumber.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-1.5 text-xs">
      <select
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        className="w-full rounded-md border border-border bg-white px-2 py-1 text-xs"
        disabled={submitting}
      >
        {CARRIERS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        placeholder="追跡番号（任意）"
        className="w-full rounded-md border border-border bg-white px-2 py-1 text-xs font-mono"
        disabled={submitting}
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex-1 rounded-md border border-foreground bg-foreground px-2 py-1 text-[11px] font-medium text-background transition hover:bg-foreground/80 disabled:opacity-50"
        >
          {submitting ? "送信中…" : "発送 + 通知メール"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={submitting}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted/50 disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>
      {error ? (
        <div className="text-[11px] text-[var(--accent-red)]">{error}</div>
      ) : null}
    </div>
  );
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
