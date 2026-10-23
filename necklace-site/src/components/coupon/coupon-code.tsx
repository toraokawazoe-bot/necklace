"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// クーポンコードを大きく出し、タップでコピーできる。購入完了画面と LINE 受け取りページで共通。
export function CouponCode({ code }: { code: string }) {
  const [state, setState] = useState<"ok" | "fail" | null>(null);
  const ref = useRef<HTMLParagraphElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("ok");
    } catch {
      // コピーできない環境では、コードを選択状態にして手動コピーしてもらう
      const el = ref.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setState("fail");
    }
  }

  return (
    <div className="w-full">
      <p
        ref={ref}
        className="select-all break-all border border-foreground/80 px-3 py-5 text-center font-mono text-[28px] font-bold tracking-wider sm:text-[34px]"
      >
        {code}
      </p>
      <Button type="button" variant="outline" className="mt-3 w-full" onClick={copy}>
        コードをコピー
      </Button>
      <p role="status" className="mt-2 min-h-6 text-[16px] text-muted-foreground">
        {state === "ok"
          ? "コピーしました"
          : state === "fail"
            ? "コピーできませんでした。コードを長押ししてコピーしてください"
            : ""}
      </p>
    </div>
  );
}
