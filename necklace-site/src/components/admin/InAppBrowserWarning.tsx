"use client";

import { useEffect, useState } from "react";

const IN_APP_PATTERNS = [
  /Line\//i,
  /Instagram/i,
  /FBAN|FBAV/i,
  /Twitter/i,
  /TikTok/i,
  /MicroMessenger/i,
];

export function InAppBrowserWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (IN_APP_PATTERNS.some((p) => p.test(ua))) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="mt-5 rounded-md border border-amber-400 bg-amber-50 px-3 py-3 text-xs text-amber-900">
      <p className="font-semibold">⚠️ アプリ内ブラウザでは Google ログインできません</p>
      <p className="mt-1.5 leading-relaxed">
        LINE / Instagram / X 等の内蔵ブラウザは Google にブロックされます。画面右上の「<span className="font-mono">⋯</span>」から
        <strong className="mx-1">Safari / Chrome で開く</strong>
        を選んでアクセスしてください。
      </p>
    </div>
  );
}
