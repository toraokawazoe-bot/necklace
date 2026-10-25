"use client";

import { useEffect, useState } from "react";

// カスタム長さ 33〜50cm に収まる首回りの範囲(目安 = レディース 首回り+4cm / メンズ 首回り+5cm)
const NECK_MIN = 27;
const NECK_MAX = 44;
const NECK_PRESETS = [30, 33, 36, 39];

export function SizeGuide({
  variant = "link",
}: {
  /** link: 商品ページ用の控えめなリンク / banner: ショップページ用の大きめカード */
  variant?: "link" | "banner";
}) {
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
      {variant === "banner" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group block w-full rounded-2xl border border-border px-5 py-6 text-left transition-colors hover:border-foreground/50 sm:px-8"
          style={{ background: "rgba(239,217,176,0.28)" }}
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
            <div className="w-full max-w-[250px] shrink-0 sm:w-[210px]">
              <NeckIllustration />
            </div>
            <div className="w-full">
              <p
                className="font-marker text-[22px] leading-[1.25] sm:text-[26px]"
                style={{ color: "var(--bead-olive)" }}
              >
                自分に合う長さを選ぶ
              </p>
              <p className="font-hand mt-2.5 text-[15px] leading-[1.85] text-foreground/85">
                首回りを測って、好みの着け心地に合う長さを探せます。
                ネックレスは1cm単位のカスタムも同価格で承ります。
              </p>
              <p
                className="font-marker mt-3.5 inline-flex items-center gap-1 text-[17px] underline-offset-4 transition-opacity group-hover:opacity-70"
                style={{ color: "var(--bead-rust)" }}
              >
                ネックレスのサイズの選び方 →
              </p>
            </div>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-hand text-[14px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          サイズの選び方 →
        </button>
      )}

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

        <SizeGuideContent />

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
            普段使っているネックレスの長さも参考にしてみてください。
            サイズについては Instagram の DM でもご相談いただけます。
          </p>
        </section>
      </div>
    </>
  );
}

/** ネックレスの長さの中身(基準・図解・測り方・計算・早見表)。モーダルと /guide/length で共用 */
export function SizeGuideContent() {
  const [neck, setNeck] = useState(33);

  const ladies = neck + 4;
  const mens = neck + 5;
  const presetHits = [ladies, mens].filter((v) => v === 38 || v === 41);

  return (
    <>
    {/* 基準ルール */}
    <section
      className="mt-5 rounded-xl px-4 py-4"
      style={{ background: "rgba(239,217,176,0.35)" }}
    >
      <p
        className="font-marker text-[17px] leading-none"
        style={{ color: "var(--bead-rust)" }}
      >
        自分に合う長さを選ぶ
      </p>
      <p className="font-hand mt-2 text-[15px] leading-[1.8] text-foreground/85">
        まずは首回りを測って、好みの着け心地に合わせて長さを選びましょう。
        レディースは<strong>「首回り＋4cm」</strong>、
        メンズは<strong>「首回り＋5cm」</strong>くらいが目安です。
        <span className="mt-1 block text-[13.5px] text-muted-foreground">
          着用位置は首の形や体格、好みによって変わります。数値は選ぶときの目安としてご覧ください。
        </span>
        <span className="mt-1 block text-[13.5px] text-muted-foreground">
          例：首回りが33cmの場合、レディースは37cm、メンズは38cmが目安です。
        </span>
      </p>
    </section>

    {/* 図解 */}
    <div className="mt-6">
      <NeckIllustration />
    </div>

    {/* 測り方 */}
    <section className="mt-7">
      <p
        className="font-marker text-[17px] leading-none"
        style={{ color: "var(--bead-blue)" }}
      >
        首回りの測り方
      </p>
      <ol className="font-hand mt-3 space-y-2 text-[15px] leading-[1.8] text-foreground/85">
        <li className="flex gap-2">
          <span style={{ color: "var(--bead-brown)" }}>1.</span>
          <span>
            首の真ん中あたりにメジャーを一周させます。
            締めつけず、肌に沿わせて測ってください
          </span>
        </li>
        <li className="flex gap-2">
          <span style={{ color: "var(--bead-brown)" }}>2.</span>
          <span>
            メジャーがない場合は、伸びにくいひもや細い紙を一周させ、重なる位置に印をつけます
          </span>
        </li>
        <li className="flex gap-2">
          <span style={{ color: "var(--bead-brown)" }}>3.</span>
          <span>
            ひもや紙をまっすぐにして、印までの長さを定規で測ります
          </span>
        </li>
        <li className="flex gap-2">
          <span style={{ color: "var(--bead-brown)" }}>4.</span>
          <span>
            首回りに <strong>レディースは＋4cm</strong>、
            <strong>メンズは＋5cm</strong> が目安です
          </span>
        </li>
      </ol>
    </section>

    {/* シミュレーター */}
    <section className="mt-7">
      <p
        className="font-marker text-[17px] leading-none"
        style={{ color: "var(--bead-blue)" }}
      >
        首回りから長さの目安を出す
      </p>
      <div className="mt-3 rounded-xl border border-border px-4 py-4">
        <p className="font-hand text-[13px] text-muted-foreground">
          首回りを入力
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setNeck((n) => Math.max(NECK_MIN, n - 1))}
            disabled={neck <= NECK_MIN}
            aria-label="首回りを1cm減らす"
            className="font-hand flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-[18px] leading-none transition-colors hover:border-foreground/50 disabled:opacity-30"
          >
            −
          </button>
          <p className="font-marker min-w-[88px] text-center text-[26px] leading-none">
            {neck}
            <span className="font-hand ml-0.5 text-[14px] text-muted-foreground">
              cm
            </span>
          </p>
          <button
            type="button"
            onClick={() => setNeck((n) => Math.min(NECK_MAX, n + 1))}
            disabled={neck >= NECK_MAX}
            aria-label="首回りを1cm増やす"
            className="font-hand flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-[18px] leading-none transition-colors hover:border-foreground/50 disabled:opacity-30"
          >
            ＋
          </button>
          <div className="ml-auto flex gap-1.5">
            {NECK_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setNeck(p)}
                className={`font-hand flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-[14px] leading-none transition-colors ${
                  neck === p
                    ? "border-foreground/60 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div
          aria-live="polite"
          className="mt-4 grid grid-cols-2 gap-2.5"
        >
          <div
            className="rounded-lg px-3 py-3"
            style={{ background: "rgba(239,217,176,0.35)" }}
          >
            <p
              className="font-hand text-[12px]"
              style={{ color: "var(--bead-blue)" }}
            >
              レディースの目安（＋4cm）
            </p>
            <p className="font-marker mt-1 text-[24px] leading-none">
              {ladies}cm
            </p>
          </div>
          <div
            className="rounded-lg px-3 py-3"
            style={{ background: "rgba(239,217,176,0.35)" }}
          >
            <p
              className="font-hand text-[12px]"
              style={{ color: "var(--bead-rust)" }}
            >
              メンズの目安（＋5cm）
            </p>
            <p className="font-marker mt-1 text-[24px] leading-none">
              {mens}cm
            </p>
          </div>
        </div>
        <p className="font-hand mt-3 text-[13px] leading-[1.7] text-muted-foreground">
          {presetHits.length > 0
            ? `選べる長さの ${presetHits.join("cm・")}cm が、目安に当たります。`
            : `サイズ選択の「好きな長さを指定する」から ${ladies}cm・${mens}cm を1cm単位・同価格で指定できます。`}
        </p>
      </div>
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
            <th className="py-2 font-normal">レディース（＋4cm）</th>
            <th className="py-2 font-normal">メンズ（＋5cm）</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr>
            <td className="py-2.5">30cm</td>
            <td className="py-2.5 font-semibold">34cm</td>
            <td className="py-2.5">35cm</td>
          </tr>
          <tr>
            <td className="py-2.5">32cm</td>
            <td className="py-2.5 font-semibold">36cm</td>
            <td className="py-2.5">37cm</td>
          </tr>
          <tr>
            <td className="py-2.5">33cm</td>
            <td className="py-2.5 font-semibold">37cm</td>
            <td className="py-2.5">38cm</td>
          </tr>
          <tr>
            <td className="py-2.5">35cm</td>
            <td className="py-2.5 font-semibold">39cm</td>
            <td className="py-2.5">40cm</td>
          </tr>
          <tr>
            <td className="py-2.5">39cm</td>
            <td className="py-2.5 font-semibold">43cm</td>
            <td className="py-2.5">44cm</td>
          </tr>
        </tbody>
      </table>
      <p className="font-hand mt-2 text-[13px] leading-[1.7] text-muted-foreground">
        希望の長さは、商品ページの「好きな長さを指定する」から1cm単位で選べます。カスタムも同価格です。
        迷ったときは、普段使っているネックレスの長さも参考にしてみてください。
      </p>
    </section>
    </>
  );
}

/** 首元〜鎖骨の線画。レディース(+4cm) / メンズ(+5cm) の落ちる位置をビーズ風の点線で示す */
function NeckIllustration() {
  return (
    <svg
      viewBox="0 0 320 180"
      role="img"
      aria-label="レディース首回り+4cmとメンズ首回り+5cmで、ネックレスが落ちる位置の違いを示すイラスト"
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

      {/* 首回りの計測位置: 首の真ん中 */}
      <path
        d="M137 50 Q160 60 183 50"
        fill="none"
        stroke="var(--bead-charcoal)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="4 3"
        opacity="0.6"
      />
      <line
        x1="135"
        y1="52"
        x2="96"
        y2="36"
        stroke="var(--bead-charcoal)"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.5"
      />
      <text
        x="8"
        y="26"
        fontSize="12"
        fontWeight="600"
        fill="var(--bead-charcoal)"
        opacity="0.8"
        className="font-hand"
      >
        首回りはここを測る
      </text>
      <text
        x="8"
        y="40"
        fontSize="10.5"
        fill="var(--bead-charcoal)"
        opacity="0.6"
        className="font-hand"
      >
        首の真ん中をひと巻き
      </text>

      {/* レディース(+4cm): 首元寄り (ビーズ風ドット) */}
      <path
        d="M132 70 Q160 96 188 70"
        fill="none"
        stroke="var(--bead-blue)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="0.1 8"
      />
      {/* メンズ(+5cm): やや下 (ビーズ風ドット) */}
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
        fontSize="14"
        fontWeight="600"
        fill="var(--bead-blue)"
        className="font-hand"
      >
        レディース＋4cm
      </text>
      <text
        x="236"
        y="76"
        fontSize="11"
        fill="var(--bead-blue)"
        className="font-hand"
      >
        首回りに＋4cm
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
        fontSize="14"
        fontWeight="600"
        fill="var(--bead-rust)"
        className="font-hand"
      >
        メンズ＋5cm
      </text>
      <text
        x="220"
        y="164"
        fontSize="11"
        fill="var(--bead-rust)"
        className="font-hand"
      >
        首回りに＋5cm
      </text>
    </svg>
  );
}
