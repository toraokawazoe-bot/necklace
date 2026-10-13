"use client";

import { useState } from "react";
import {
  CHANNEL_OPTIONS,
  Order,
  SNS_PLACE_LABEL,
  SnsIdea,
  SnsPolicy,
  SnsPostRecord,
  isInstagramPost,
  isTikTok,
} from "@/lib/types";
import { DAY, addPost, fmtDateTime, jstDate, jstDayStart, jstWeekday, needsNumbers, weekRange } from "@/lib/sns";
import { SEASON_EVENTS } from "@/lib/snsKnowledge";
import { Bar } from "./common";
import type { SnsTab } from "../SnsPlan";
import styles from "../SnsPlan.module.css";

interface Props {
  policy: SnsPolicy;
  posts: SnsPostRecord[];
  ideas: SnsIdea[];
  orders: Order[];
  ready: boolean;
  onGo: (t: SnsTab) => void;
}

export default function Today({ policy, posts, ideas, orders, ready, onGo }: Props) {
  const now = Date.now();
  const todayStart = jstDayStart(now);
  const wd = jstWeekday(now);
  const today = jstDate(now);
  const range = weekRange(now);
  const [adding, setAdding] = useState(false);

  const todayPosts = posts.filter((p) => p.ts >= todayStart && p.ts < todayStart + DAY);
  const storiesToday = todayPosts.filter((p) => p.place === "igStory").length;
  const isRest = policy.restDays.indexOf(wd) !== -1;
  const planned = isRest ? [] : policy.schedule[wd] ?? [];
  const missing = posts.filter((p) => needsNumbers(p, now));
  const unsorted = ideas.filter((i) => i.status === "未仕分け").length;

  const week = posts.filter((p) => p.ts >= range.start && p.ts < range.end);
  const weekFeed = week.filter((p) => p.place !== "igStory");
  const tiktok = week.filter((p) => isTikTok(p.place)).length;
  const ig = week.filter((p) => isInstagramPost(p.place)).length;
  const reel = week.filter((p) => p.place === "igReel").length;
  const stories = week.filter((p) => p.place === "igStory").length;
  const wearing = weekFeed.filter((p) => p.wearing).length;
  const wearingPct = weekFeed.length ? Math.round((wearing / weekFeed.length) * 100) : null;
  const notices = week.filter((p) => p.notice).length;

  const events = SEASON_EVENTS.filter((e) => e.start <= today && today <= e.end);
  const soonLimit = jstDate(now + 21 * DAY);
  const upcoming = SEASON_EVENTS.filter((e) => e.start > today && e.start <= soonLimit);

  const weekOrders = orders.filter((o) => o.created >= range.start && o.created < range.end);
  const byChannel: Record<string, number> = {};
  for (const o of weekOrders) {
    const c = o.channel || "未選択";
    byChannel[c] = (byChannel[c] ?? 0) + 1;
  }

  const addStory = async () => {
    if (adding) return;
    setAdding(true);
    try {
      await addPost({
        ts: Date.now(),
        place: "igStory",
        formatLabel: "ストーリーズ",
        views: null,
        saves: null,
      });
    } catch (e) {
      console.error("add story failed", e);
      alert("記録できませんでした。通信状況を確認してもう一度お試しください。");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <section className={styles.card}>
        <h3 className={styles.h3}>今日やること</h3>
        <div className={styles.note}>
          {today.slice(5).replace("-", "/")}({wd}){isRest ? " お休みの日" : ""}
        </div>

        <div className={styles.todoRow}>
          <div className={styles.todoMain}>
            <strong>ストーリーズ</strong>
            <span className={storiesToday >= policy.storiesPerDay ? styles.okText : styles.dim}>
              {" "}
              {storiesToday}/{policy.storiesPerDay}枚
            </span>
          </div>
          <button type="button" className={styles.secondary} onClick={addStory} disabled={!ready || adding}>
            {adding ? "記録中…" : "+1枚 記録"}
          </button>
        </div>

        <div className={styles.todoRow}>
          <div className={styles.todoMain}>
            <strong>今日の予定投稿</strong>
            {planned.length === 0 ? (
              <div className={styles.dim}>今日は予定なし(台本づくり・撮影の日)</div>
            ) : (
              <ul className={styles.plain}>
                {planned.map((pl, i) => {
                  const done = todayPosts.some((p) => p.place === pl);
                  return (
                    <li key={pl + i} className={done ? styles.okText : undefined}>
                      {done ? "✓ " : "・"}
                      {SNS_PLACE_LABEL[pl]}
                      {done ? "(投稿済み)" : ` ${policy.postTime}`}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {planned.length > 0 && (
            <button type="button" className={styles.secondary} onClick={() => onGo("create")}>
              作る
            </button>
          )}
        </div>

        <div className={styles.todoRow}>
          <div className={styles.todoMain}>
            <strong>数字を入れて</strong>
            <div className={missing.length ? styles.warnText : styles.dim}>
              {missing.length
                ? `3日たった投稿 ${missing.length}本 の再生数・保存数がまだ`
                : "入れ忘れはありません"}
            </div>
            {missing.slice(0, 3).map((p) => (
              <div key={p.id} className={styles.dim}>
                {fmtDateTime(p.ts)} {SNS_PLACE_LABEL[p.place]} {p.formatLabel}
              </div>
            ))}
          </div>
          {missing.length > 0 && (
            <button type="button" className={styles.secondary} onClick={() => onGo("review")}>
              入れる
            </button>
          )}
        </div>

        <div className={styles.todoRow}>
          <div className={styles.todoMain}>
            <strong>アイデア箱の未仕分け</strong>
            <span className={styles.dim}> {unsorted}件</span>
          </div>
          <button type="button" className={styles.secondary} onClick={() => onGo("ideas")}>
            開く
          </button>
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>今週の進み具合</h3>
        <div className={styles.note}>{range.label}</div>
        <Bar label="TikTok" done={tiktok} target={policy.tiktokPerWeek} note="写真スライドで可。動画は任意" />
        <Bar label="Instagram" done={ig} target={policy.igPerWeek} />
        <Bar label="うちリール" done={reel} target={policy.igReelPerWeek} />
        <Bar label="ストーリーズ" done={stories} target={policy.storiesPerDay * 7} note={`1日 ${policy.storiesPerDay} 枚 × 7日`} />
        <div className={styles.statLine}>
          <span>「人が着けた姿」の割合</span>
          <strong className={wearingPct != null && wearingPct < policy.wearingMinPct ? styles.warnText : undefined}>
            {wearingPct == null ? "—" : `${wearingPct}%`}
          </strong>
          <span className={styles.dim}>目標 {policy.wearingMinPct}%以上</span>
        </div>
        <div className={styles.statLine}>
          <span>告知・販売の投稿</span>
          <strong className={notices > policy.noticeMaxPerWeek ? styles.warnText : undefined}>{notices}本</strong>
          <span className={styles.dim}>週{policy.noticeMaxPerWeek}本まで</span>
        </div>
        {notices > policy.noticeMaxPerWeek && (
          <div className={styles.warnBox}>告知が多めです。見られても保存されにくいので、次は「着る」投稿にしましょう。</div>
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>季節のお知らせ</h3>
        {events.length === 0 && upcoming.length === 0 && <div className={styles.note}>今は投稿開始の目安に入ったイベントはありません</div>}
        {events.map((e) => (
          <div key={e.name} className={styles.eventBox}>
            <strong>
              {e.name}({e.date})
            </strong>
            <div>{e.idea}</div>
            <div className={styles.dim}>投稿開始の目安:{e.startLabel}(いま準備する時期)</div>
          </div>
        ))}
        {upcoming.length > 0 && (
          <>
            <div className={styles.subHead}>もうすぐ始まる</div>
            {upcoming.map((e) => (
              <div key={e.name} className={styles.dim}>
                {e.startLabel}〜 {e.name}:{e.idea}
              </div>
            ))}
          </>
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.h3}>今週の注文:{weekOrders.length}件</h3>
        {weekOrders.length > 0 ? (
          <div className={styles.chips}>
            {[...CHANNEL_OPTIONS, "未選択"]
              .filter((c) => byChannel[c])
              .map((c) => (
                <span key={c} className={styles.tag}>
                  {c} {byChannel[c]}件
                </span>
              ))}
          </div>
        ) : (
          <div className={styles.note}>今週はまだ注文がありません</div>
        )}
        <div className={styles.note}>注文が入ったら「どこで知りましたか?」を聞いて、注文の「どこから来た注文?」を押す</div>
      </section>
    </>
  );
}
