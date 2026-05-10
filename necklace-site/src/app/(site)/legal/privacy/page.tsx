import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. 収集する情報",
    body: (
      <>
        当サイトでは、商品のご購入およびお問い合わせ対応のため、お客様の氏名、住所、電話番号、メールアドレス、お届け先情報、ご注文内容を収集します。
        クレジットカード番号等の決済情報は当サイトでは保持せず、決済代行サービスである Stripe（Stripe, Inc.）にて安全に処理されます。
      </>
    ),
  },
  {
    title: "2. 利用目的",
    body: (
      <>
        収集した情報は、商品の発送、ご注文・ご入金の確認、お問い合わせ対応、不良品交換などのアフターサービスのために利用します。
        ご本人の同意なく、上記の目的以外には使用いたしません。
      </>
    ),
  },
  {
    title: "3. 第三者提供",
    body: (
      <>
        法令に基づく場合、または商品発送のために配送業者に必要な範囲で提供する場合を除き、お客様の個人情報を第三者に提供することはありません。
      </>
    ),
  },
  {
    title: "4. 委託先",
    body: (
      <>
        以下のサービスに対して、業務委託の範囲で必要なデータを取り扱います。
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Stripe, Inc.（決済処理）</li>
          <li>Vercel Inc.（サイトホスティング）</li>
          <li>Resend（注文確認メール送信）</li>
          <li>Upstash, Inc.（在庫情報の管理）</li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Cookie について",
    body: (
      <>
        当サイトでは、カート機能の維持のために、ブラウザの localStorage を使用します。
        また、Stripe Checkout 画面では決済処理のために Stripe 側で Cookie が利用される場合があります。
      </>
    ),
  },
  {
    title: "6. 開示・訂正・削除",
    body: (
      <>
        ご自身の個人情報の開示、訂正、削除をご希望の場合は、torao0922@icloud.com までご連絡ください。
        ご本人であることを確認した上で、合理的な期間内に対応いたします。
      </>
    ),
  },
  {
    title: "7. お問い合わせ窓口",
    body: (
      <>
        個人情報の取り扱いに関するお問い合わせは、下記までご連絡ください。
        <br />
        740NLL（個人事業主）
        <br />
        メール：
        <a
          href="mailto:torao0922@icloud.com"
          className="underline-offset-4 hover:underline"
          style={{ color: "var(--bead-blue)" }}
        >
          torao0922@icloud.com
        </a>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 md:py-28">
      <p
        className="font-marker text-3xl leading-none md:text-4xl"
        style={{ color: "var(--bead-olive)" }}
      >
        Privacy
      </p>
      <h1 className="font-hand mt-6 text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-[1.2] tracking-tight">
        プライバシーポリシー
      </h1>
      <p className="font-hand mt-6 text-[15px] leading-[1.85] text-foreground/80">
        740NLL（以下「当サイト」）は、お客様の個人情報を以下の方針で取り扱います。
      </p>

      <div className="mt-12 space-y-9">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-hand text-[17px] font-semibold text-foreground">
              {s.title}
            </h2>
            <div className="font-hand mt-3 text-[15px] leading-[1.95] text-foreground/85">
              {s.body}
            </div>
          </section>
        ))}
      </div>

      <p className="font-hand mt-12 text-[13px] leading-[1.85] text-muted-foreground">
        最終更新日：2026 年 5 月 9 日
      </p>
    </article>
  );
}
