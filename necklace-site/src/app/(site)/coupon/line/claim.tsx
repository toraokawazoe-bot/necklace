"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CouponCode } from "@/components/coupon/coupon-code";

type State =
  | { kind: "loading" }
  | { kind: "ok"; code: string; used: boolean }
  | { kind: "error"; message: string };

export function LineCouponClaim({ uid }: { uid: string | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/coupon/line", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          code?: string;
          status?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.code) {
          setState({
            kind: "error",
            message: data.error ?? "クーポンの発行に失敗しました。時間をおいてもう一度お試しください。",
          });
          return;
        }
        setState({ kind: "ok", code: data.code, used: data.status === "used" });
      } catch {
        if (!cancelled) {
          setState({
            kind: "error",
            message: "通信に失敗しました。電波の良い場所でもう一度お試しください。",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, attempt]);

  if (state.kind === "loading") {
    return (
      <p className="font-hand mt-8 text-[16px] leading-[1.85] text-muted-foreground" role="status">
        クーポンを用意しています…
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="mt-8 flex flex-col items-center">
        <p className="font-hand max-w-md text-[16px] leading-[1.85] text-muted-foreground" role="alert">
          {state.message}
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          もう一度試す
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-8 flex w-full max-w-sm flex-col items-center">
      <p className="font-hand text-[16px] leading-[1.85] text-muted-foreground">
        友だち追加ありがとうございます。ネックレスに使えるクーポンです（10%オフ・1回限り・期限なし・送料は対象外）。
      </p>
      <div className="mt-6 w-full">
        <CouponCode code={state.code} />
      </div>
      {state.used ? (
        <p className="font-hand mt-2 text-[16px] leading-[1.85] text-muted-foreground">
          このコードはすでに使用済みです。
        </p>
      ) : (
        <p className="font-hand mt-2 text-[16px] leading-[1.85] text-muted-foreground">
          ご注文時にカートのクーポン欄へ入力してください。このページを開き直しても同じコードが表示されます。
        </p>
      )}
      <Link href="/products?category=necklace" className="mt-6 w-full">
        <Button className="w-full" size="lg">
          ネックレスを見る
        </Button>
      </Link>
    </div>
  );
}
