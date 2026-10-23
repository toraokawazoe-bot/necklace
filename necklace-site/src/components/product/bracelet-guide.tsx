"use client";

import { useState } from "react";
import { BRACELET_DEFAULT, BRACELET_SIZES } from "@/lib/product-category";

// 手首回り+1cmでぴったり、+2cmでゆったり(目安)
const WRIST_MIN = 14;
const WRIST_MAX = 18;
const WRIST_PRESETS = [14, 15, 16, 17];
const TABLE_ROWS = [14, 15, 16, 17, 18];

const SIZE_MIN = BRACELET_SIZES[0];
const SIZE_MAX = BRACELET_SIZES[BRACELET_SIZES.length - 1];

/** 選べる長さ(16〜19cm)の中で一番近いもの */
function nearest(cm: number): { value: number; clamped: boolean } {
  const value = Math.min(SIZE_MAX, Math.max(SIZE_MIN, cm));
  return { value, clamped: value !== cm };
}

function Cell({ cm }: { cm: number }) {
  const n = nearest(cm);
  return (
    <>
      {n.value}cm{n.clamped && <span aria-label="範囲外のため近い長さ">*</span>}
    </>
  );
}

export function BraceletGuide() {
  const [wrist, setWrist] = useState(16);
  const just = nearest(wrist + 1);
  const loose = nearest(wrist + 2);
  const outOfRange = just.clamped || loose.clamped;

  const stepBtn =
    "font-hand flex h-11 w-11 items-center justify-center rounded-full border border-border text-[20px] leading-none transition-colors hover:border-foreground/50 disabled:opacity-30";

  return (
    <div>
      <p className="font-hand text-[16px] leading-[1.9] text-foreground/85">
        長さは <strong>{BRACELET_SIZES.join("・")}cm</strong> から選べます
        (初期は {BRACELET_DEFAULT}cm)。目安は、手首回りに
        <strong>＋1cm でぴったり</strong>、<strong>＋2cm でゆったり</strong>
        です。
      </p>
      <p className="font-hand mt-2 text-[14px] leading-[1.8] text-muted-foreground">
        例：手首回り16cmなら → ぴったり17cm／ゆったり18cm
      </p>

      <p
        className="font-marker mt-7 text-[17px] leading-none"
        style={{ color: "var(--bead-blue)" }}
      >
        あなたのサイズを出してみる
      </p>
      <div className="mt-3 rounded-xl border border-border px-4 py-4">
        <p className="font-hand text-[14px] text-muted-foreground">手首回り</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setWrist((n) => Math.max(WRIST_MIN, n - 1))}
            disabled={wrist <= WRIST_MIN}
            aria-label="手首回りを1cm減らす"
            className={stepBtn}
          >
            −
          </button>
          <p className="font-marker min-w-[88px] text-center text-[26px] leading-none">
            {wrist}
            <span className="font-hand ml-0.5 text-[14px] text-muted-foreground">
              cm
            </span>
          </p>
          <button
            type="button"
            onClick={() => setWrist((n) => Math.min(WRIST_MAX, n + 1))}
            disabled={wrist >= WRIST_MAX}
            aria-label="手首回りを1cm増やす"
            className={stepBtn}
          >
            ＋
          </button>
          <div className="flex gap-1.5 sm:ml-auto">
            {WRIST_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setWrist(p)}
                aria-pressed={wrist === p}
                className={`font-hand flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-[14px] leading-none transition-colors ${
                  wrist === p
                    ? "border-foreground/60 text-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div aria-live="polite" className="mt-4 grid grid-cols-2 gap-2.5">
          <div
            className="rounded-lg px-3 py-3"
            style={{ background: "rgba(239,217,176,0.35)" }}
          >
            <p
              className="font-hand text-[14px]"
              style={{ color: "var(--bead-blue)" }}
            >
              ぴったり（＋1cm）
            </p>
            <p className="font-marker mt-1 text-[24px] leading-none">
              {just.value}cm
            </p>
          </div>
          <div
            className="rounded-lg px-3 py-3"
            style={{ background: "rgba(239,217,176,0.35)" }}
          >
            <p
              className="font-hand text-[14px]"
              style={{ color: "var(--bead-rust)" }}
            >
              ゆったり（＋2cm）
            </p>
            <p className="font-marker mt-1 text-[24px] leading-none">
              {loose.value}cm
            </p>
          </div>
        </div>
        <p
          aria-live="polite"
          className="font-hand mt-3 text-[14px] leading-[1.8] text-muted-foreground"
        >
          {outOfRange
            ? `目安は ${wrist + 1}〜${wrist + 2}cm ですが、選べるのは${SIZE_MIN}〜${SIZE_MAX}cm。この中で一番近い長さを出しています。範囲の外の長さを希望の方は、LINEで相談してください。`
            : "商品ページの「サイズを選ぶ」から、この長さを選べます。"}
        </p>
      </div>

      <p
        className="font-marker mt-7 text-[17px] leading-none"
        style={{ color: "var(--bead-blue)" }}
      >
        手首回り早見表
      </p>
      <table className="font-hand mt-3 w-full text-left text-[16px]">
        <thead>
          <tr className="border-b border-border text-[14px] text-muted-foreground">
            <th className="py-2 font-normal">手首回り</th>
            <th className="py-2 font-normal">ぴったり（＋1cm）</th>
            <th className="py-2 font-normal">ゆったり（＋2cm）</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {TABLE_ROWS.map((w) => (
            <tr key={w}>
              <td className="py-2.5">{w}cm</td>
              <td className="py-2.5 font-semibold">
                <Cell cm={w + 1} />
              </td>
              <td className="py-2.5">
                <Cell cm={w + 2} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-hand mt-2 text-[14px] leading-[1.8] text-muted-foreground">
        * 選べる長さ（{SIZE_MIN}〜{SIZE_MAX}cm）の範囲外のため、一番近い長さです。
      </p>
    </div>
  );
}
