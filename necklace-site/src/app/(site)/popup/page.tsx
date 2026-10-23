import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { LINE_URL } from "@/lib/line";
import {
  formatPopupDates,
  popupMapUrl,
  upcomingPopups,
  type Popup,
} from "@/lib/popups";
import { cn } from "@/lib/utils";

// 今日(日本時間)で表示が変わるので、リクエストごとに描画する
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "次のポップアップ",
  description:
    "740NLLのポップアップの予定。手で編んだネックレス・ブレスレットを、実際に手に取って選べます。LINEの友だち限定でネックレス10%オフ。",
  openGraph: {
    title: "次のポップアップ | 740NLL",
    description:
      "手で編んだネックレス・ブレスレットを、実際に手に取って選べます。LINEの友だち限定でネックレス10%オフ。",
  },
};

const DOINGS = [
  { title: "試着できる", body: "ネックレスもブレスレットも、鏡の前でつけて確かめられます。" },
  { title: "色や長さの相談ができる", body: "似合う色や、ちょうどいい長さを一緒に選びます。" },
  {
    title: "その場でオーダーして、後日発送",
    body: "気に入ったものがその場でなくても大丈夫。注文を受けて、あとからお届けします(送料は一律150円)。",
  },
];

export default function PopupPage() {
  const list = upcomingPopups();
  const [next, ...rest] = list;

  return (
    <article className="mx-auto max-w-2xl px-6 py-20 md:py-28">
      <p
        className="font-marker text-3xl leading-none md:text-4xl"
        style={{ color: "var(--bead-rust)" }}
      >
        Pop-up
      </p>
      <h1 className="font-hand mt-7 text-[clamp(2.4rem,6vw,4.2rem)] font-semibold leading-[1.1] tracking-tight">
        <span style={{ color: "var(--bead-blue)" }}>次の</span>
        <span style={{ color: "var(--bead-brown)" }}>ポップアップ</span>
      </h1>

      {/* 次のポップアップ */}
      <section className="mt-12">
        {next ? (
          <>
            <NextPopup popup={next} />
            {rest.length > 0 && (
              <ul className="mt-10 space-y-6">
                {rest.map((p) => (
                  <li
                    key={`${p.startDate}-${p.name}`}
                    className="border-t border-border pt-5"
                  >
                    <p
                      className="font-marker text-[20px] leading-[1.3]"
                      style={{ color: "var(--bead-olive)" }}
                    >
                      {formatPopupDates(p)}
                    </p>
                    <p className="font-hand mt-2 text-[17px] font-semibold">
                      {p.name}
                    </p>
                    <PopupDetails popup={p} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="font-hand text-[17px] leading-[1.95] text-foreground">
            次の予定は決まり次第ここに載せます。LINEでもお知らせします。
          </p>
        )}
      </section>

      {/* どんな場所? */}
      <section className="mt-16 border-t border-border pt-9">
        <p
          className="font-marker text-2xl leading-none md:text-3xl"
          style={{ color: "var(--bead-olive)" }}
        >
          ポップアップってどんな場所?
        </p>
        <p className="font-hand mt-5 text-[17px] leading-[1.95] text-foreground/85">
          1本ずつ手で編んだネックレス・ブレスレットを、実際に手に取って、つけて選べる場所です。
          冬は新作(スマホストラップ・バッグチャームなど)も並びます。
        </p>
      </section>

      {/* 当日できること */}
      <section className="mt-12 border-t border-border pt-9">
        <p
          className="font-marker text-2xl leading-none md:text-3xl"
          style={{ color: "var(--bead-brown)" }}
        >
          当日できること
        </p>
        <ul className="mt-6 space-y-5">
          {DOINGS.map((d) => (
            <li key={d.title}>
              <p className="font-hand text-[18px] font-semibold">{d.title}</p>
              <p className="font-hand mt-1.5 text-[16px] leading-[1.9] text-foreground/85">
                {d.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* 支払い */}
      <section className="mt-12 border-t border-border pt-9">
        <p
          className="font-marker text-2xl leading-none md:text-3xl"
          style={{ color: "var(--bead-blue)" }}
        >
          お支払い
        </p>
        <p className="font-hand mt-5 text-[17px] leading-[1.95] text-foreground/85">
          現金・PayPayがご利用いただけます。手ぶらでお越しください。
        </p>
      </section>

      {/* LINE友だち限定 */}
      <section
        className="mt-12 rounded-xl px-5 py-6"
        style={{ background: "rgba(239,217,176,0.35)" }}
      >
        <p
          className="font-marker text-[22px] leading-[1.3]"
          style={{ color: "var(--bead-rust)" }}
        >
          LINEの友だち限定
        </p>
        <p className="font-hand mt-3 text-[17px] leading-[1.9] text-foreground/85">
          会場でLINEのトーク画面を見せると、
          <strong>ネックレスが10%オフ</strong>になります。
        </p>
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-hand mt-3 inline-flex min-h-11 items-center text-[16px] underline underline-offset-4"
        >
          LINEの友だちになる
        </a>
      </section>

      {/* ボタン */}
      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/products"
          className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
        >
          ショップを見る
        </Link>
        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "w-full sm:w-auto",
          )}
        >
          LINEで相談する
        </a>
      </div>
    </article>
  );
}

function NextPopup({ popup }: { popup: Popup }) {
  return (
    <div className="rounded-xl border border-border px-5 py-7">
      <p
        className="font-marker text-[clamp(1.75rem,6vw,2.5rem)] leading-[1.2]"
        style={{ color: "var(--bead-rust)" }}
      >
        {formatPopupDates(popup)}
      </p>
      <p className="font-hand mt-3 text-[20px] font-semibold leading-[1.5]">
        {popup.name}
      </p>
      <PopupDetails popup={popup} />
    </div>
  );
}

function PopupDetails({ popup }: { popup: Popup }) {
  return (
    <div className="font-hand mt-3 space-y-1.5 text-[16px] leading-[1.9] text-foreground/85">
      <p>{popup.time}</p>
      <p>
        {popup.venue}
        <br />
        {popup.address}
      </p>
      {popup.note && <p>{popup.note}</p>}
      <p className="flex flex-wrap gap-x-6">
        <a
          href={popupMapUrl(popup)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center underline underline-offset-4"
        >
          地図を開く
        </a>
        {popup.url && (
          <a
            href={popup.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            詳細を見る
          </a>
        )}
      </p>
    </div>
  );
}
