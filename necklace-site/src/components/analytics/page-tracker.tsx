"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PageTracker() {
  return (
    <Suspense fallback={null}>
      <PageTrackerInner />
    </Suspense>
  );
}

function PageTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;

    const path = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    if (lastSent.current === path) return;
    lastSent.current = path;

    const referrer = typeof document !== "undefined" ? document.referrer : "";

    const payload = JSON.stringify({ path, referrer });

    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/track", blob);
      if (ok) return;
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname, searchParams]);

  return null;
}
