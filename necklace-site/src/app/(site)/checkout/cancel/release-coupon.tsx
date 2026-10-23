"use client";

import { useEffect } from "react";

// 決済ページから戻ってきた時、予約していたクーポンをすぐ使える状態に戻す(失敗しても画面は変えない)。
export function ReleaseCouponOnMount({ sessionId }: { sessionId: string | null }) {
  useEffect(() => {
    if (!sessionId) return;
    void fetch("/api/checkout/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }, [sessionId]);
  return null;
}
