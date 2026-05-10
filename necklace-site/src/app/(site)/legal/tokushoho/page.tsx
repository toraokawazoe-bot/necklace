import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
};

const ROWS: { label: string; value: React.ReactNode }[] = [
  { label: "販売事業者", value: "740NLL（個人事業主）" },
  {
    label: "運営責任者",
    value: "ご請求があれば遅滞なく開示いたします",
  },
  {
    label: "所在地",
    value: "ご請求があれば遅滞なく開示いたします",
  },
  {
    label: "電話番号",
    value: "ご請求があれば遅滞なく開示いたします（受付時間 平日 11:00–18:00）",
  },
  {
    label: "メールアドレス",
    value: (
      <a
        href="mailto:torao0922@icloud.com"
        className="underline-offset-4 hover:underline"
        style={{ color: "var(--bead-blue)" }}
      >
        torao0922@icloud.com
      </a>
    ),
  },
  { label: "販売価格", value: "各商品ページに記載の価格（税込）" },
  {
    label: "商品代金以外の必要料金",
    value: (
      <>
        送料：全国一律 ¥150
        <br />
        コンビニ払い／銀行振込をご選択の場合、決済手数料は当方が負担いたします。
      </>
    ),
  },
  {
    label: "支払方法",
    value: (
      <>
        クレジットカード（Visa／Mastercard／American Express／JCB／Diners／Discover）
        <br />
        コンビニ払い（セブン-イレブン／ローソン／ファミリーマート／ミニストップ）
        <br />
        銀行振込（Stripe 経由の仮想口座への振込）
      </>
    ),
  },
  {
    label: "支払時期",
    value: (
      <>
        クレジットカード：ご注文時に決済が確定します。
        <br />
        コンビニ払い：ご注文後 3 日以内にお支払いください。
        <br />
        銀行振込：ご注文後 3 日以内にお振込みください。
      </>
    ),
  },
  {
    label: "商品の引渡時期",
    value: (
      <>
        ご注文（ご入金）確認後、通常 3〜7 営業日以内に発送いたします。
        <br />
        受注制作の場合は別途お時間をいただくことがあり、その際は事前にメールでご連絡いたします。
      </>
    ),
  },
  {
    label: "返品・交換",
    value: (
      <>
        商品の性質上、お客様都合による返品・交換はお受けできません。
        <br />
        商品の不良・破損・誤配送等の場合は、商品到着後 7 日以内に
        torao0922@icloud.com までご連絡ください。良品との交換、または同額のご返金にて対応いたします。
        <br />
        この場合の返送送料は当方が負担いたします。
      </>
    ),
  },
  {
    label: "動作環境",
    value: "当サイトは最新のモダンブラウザ（Chrome／Safari／Firefox／Edge の最新版）でのご利用を推奨しています。",
  },
];

export default function TokushohoPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 md:py-28">
      <p
        className="font-marker text-3xl leading-none md:text-4xl"
        style={{ color: "var(--bead-brown)" }}
      >
        Legal
      </p>
      <h1 className="font-hand mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-[1.2] tracking-tight">
        特定商取引法に基づく表記
      </h1>
      <p className="font-hand mt-6 text-[15px] leading-[1.85] text-foreground/80">
        本ページは、特定商取引法第 11 条に基づく表記です。本表記は予告なく変更される場合があります。
      </p>

      <dl className="mt-12 divide-y divide-border border-y border-border">
        {ROWS.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-1 gap-2 py-5 md:grid-cols-[12rem_1fr] md:gap-8 md:py-6"
          >
            <dt className="font-hand text-[14px] font-semibold text-foreground/70">
              {row.label}
            </dt>
            <dd className="font-hand text-[15px] leading-[1.85] text-foreground/90">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="font-hand mt-10 text-[13px] leading-[1.85] text-muted-foreground">
        最終更新日：2026 年 5 月 9 日
      </p>
    </article>
  );
}
