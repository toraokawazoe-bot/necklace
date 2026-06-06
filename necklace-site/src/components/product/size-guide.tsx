"use client";

import { useEffect, useState } from "react";

export function SizeGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-hand text-[14px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        サイズの選び方 →
      </button>

      {/* オーバーレイ */}
      <div
        className={`fixed inset-0 z-40 bg-foreground/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* パネル: モバイルは下からのシート、sm以上は中央カード */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="サイズの選び方"
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-2xl bg-background px-5 pb-8 pt-5 transition-all duration-300 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-border sm:p-8 ${
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-6 opacity-0 sm:translate-y-[calc(-50%+24px)]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <p
            className="font-marker text-[24px] leading-none sm:text-[28px]"
            style={{ color: "var(--bead-olive)" }}
          >
            サイズの選び方
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="閉じる"
            className="font-hand -mr-1 -mt-1 px-2 py-1 text-[20px] leading-none text-muted-foreground transition-colors hover:text-foreground"
          >
            ×
          </button>
        </div>

        {/* 図解 */}
        <div className="mt-5">
          <NeckIllustration />
        </div>

        {/* 測り方 */}
        <section className="mt-7">
          <p
            className="font-marker text-[17px] leading-none"
            style={{ color: "var(--bead-blue)" }}
          >
            メジャーがなくても測れます
          </p>
          <ol className="font-hand mt-3 space-y-2 text-[15px] leading-[1.8] text-foreground/85">
            <li className="flex gap-2">
              <span style={{ color: "var(--bead-brown)" }}>1.</span>
              <span>
                紐や充電ケーブルを、首の付け根にゆるくひと巻きします
              </span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--bead-brown)" }}>2.</span>
              <span>重なったところを指でつまんで、定規にあてて測ります</span>
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--bead-brown)" }}>3.</span>
              <span>
                その長さ（首回り）に <strong>+5cm で首元フィット</strong>、
                <strong>+8cm で鎖骨ライン</strong>が目安です
              </span>
            </li>
          </ol>
        </section>

        {/* 早見表 */}
        <section className="mt-7">
          <p
            className="font-marker text-[17px] leading-none"
            style={{ color: "var(--bead-blue)" }}
          >
            首回り早見表
          </p>
          <table className="font-hand mt-3 w-full text-left text-[15px]">
            <thead>
              <tr className="border-b border-border text-[13px] text-muted-foreground">
                <th className="py-2 font-normal">首回り</th>
                <th className="py-2 font-normal">おすすめ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2.5">〜33cm（細め）</td>
                <td className="py-2.5 font-semibold">38cm</td>
              </tr>
              <tr>
                <td className="py-2.5">34〜36cm</td>
                <td className="py-2.5">
                  どちらもOK
                  <span className="block text-[13px] font-normal text-muted-foreground">
                    フィット派は38 / ゆったり派は41
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5">37cm〜（しっかりめ）</td>
                <td className="py-2.5 font-semibold">41cm</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 迷ったら */}
        <section
          className="mt-7 rounded-xl px-4 py-4"
          style={{ background: "rgba(239,217,176,0.35)" }}
        >
          <p
            className="font-marker text-[17px] leading-none"
            style={{ color: "var(--bead-rust)" }}
          >
            迷ったら
          </p>
          <p className="font-hand mt-2 text-[15px] leading-[1.8] text-foreground/85">
            全てアジャスター付きで ±2cm 調整できるので、
            迷ったら <strong>41cm</strong> がおすすめ（詰めて短くも使えます）。
            ジャストサイズで作りたい方は Instagram DM
            で首回りを教えてください。1cm単位・同価格でお作りします。
          </p>
        </section>
      </div>
    </>
  );
}

/** 首元〜鎖骨の線画。38cm / 41cm の落ちる位置をビーズ風の点線で示す */
function NeckIllustration() {
  return (
    <svg
      viewBox="0 0 320 180"
      role="img"
      aria-label="38cmは首元、41cmは鎖骨ラインに落ちるイラスト"
      className="mx-auto block w-full max-w-[320px]"
    >
      {/* 顔の輪郭(あご) */}
      <path
        d="M118 4 Q128 38 160 40 Q192 38 202 4"
        fill="none"
        stroke="var(--bead-charcoal)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* 首 */}
      <path
        d="M136 36 Q138 66 128 84"
        fill="none"
        stroke="var(--bead-charcoal)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M184 36 Q182 66 192 84"
        fill="none"
        stroke="var(--bead-charcoal)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* 肩 */}
      <path
        d="M128 84 Q90 96 56 124"
        fill="none"
        stroke="var(--bead-charcoal)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M192 84 Q230 96 264 124"
        fill="none"
        stroke="var(--bead-charcoal)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* 鎖骨 */}
      <path
        d="M120 106 Q142 114 156 108"
        fill="none"
        stroke="var(--bead-charcoal)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M200 106 Q178 114 164 108"
        fill="none"
        stroke="var(--bead-charcoal)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />

      {/* 38cm: 首元フィット (ビーズ風ドット) */}
      <path
        d="M132 70 Q160 96 188 70"
        fill="none"
        stroke="var(--bead-blue)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="0.1 8"
      />
      {/* 41cm: 鎖骨ライン */}
      <path
        d="M124 88 Q160 132 196 88"
        fill="none"
        stroke="var(--bead-rust)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="0.1 8"
      />

      {/* 引き出し線 + ラベル */}
      <line
        x1="190"
        y1="82"
        x2="232"
        y2="62"
        stroke="var(--bead-blue)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <text
        x="236"
        y="60"
        fontSize="15"
        fontWeight="600"
        fill="var(--bead-blue)"
        className="font-hand"
      >
        38cm
      </text>
      <text
        x="236"
        y="76"
        fontSize="11"
        fill="var(--bead-blue)"
        className="font-hand"
      >
        首元にフィット
      </text>

      <line
        x1="178"
        y1="118"
        x2="216"
        y2="142"
        stroke="var(--bead-rust)"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <text
        x="220"
        y="148"
        fontSize="15"
        fontWeight="600"
        fill="var(--bead-rust)"
        className="font-hand"
      >
        41cm
      </text>
      <text
        x="220"
        y="164"
        fontSize="11"
        fill="var(--bead-rust)"
        className="font-hand"
      >
        鎖骨ライン
      </text>
    </svg>
  );
}
