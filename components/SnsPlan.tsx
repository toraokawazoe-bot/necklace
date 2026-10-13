"use client";

import { useEffect, useRef, useState } from "react";
import { Order, SnsIdea, SnsPolicy, SnsPostRecord } from "@/lib/types";
import {
  DEFAULT_POLICY,
  SnsSettingsState,
  migrateLegacyPostsOnce,
  savePolicy,
  subscribeIdeas,
  subscribePosts,
  subscribeSnsSettings,
} from "@/lib/sns";
import Today from "./sns/Today";
import Ideas from "./sns/Ideas";
import Create, { CreatePreset } from "./sns/Create";
import Review from "./sns/Review";
import Knowledge from "./sns/Knowledge";
import styles from "./SnsPlan.module.css";

interface Props {
  orders: Order[];
}

export type SnsTab = "today" | "ideas" | "create" | "review" | "knowledge";

const TABS: { value: SnsTab; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "ideas", label: "アイデア箱" },
  { value: "create", label: "作る" },
  { value: "review", label: "振り返り" },
  { value: "knowledge", label: "ナレッジ" },
];

export type SaveState = "idle" | "saving" | "saved" | "error";

export default function SnsPlan({ orders }: Props) {
  const [tab, setTab] = useState<SnsTab>("today");
  const [settings, setSettings] = useState<SnsSettingsState | null>(null);
  const [policy, setPolicy] = useState<SnsPolicy>(DEFAULT_POLICY);
  const [ideas, setIdeas] = useState<SnsIdea[]>([]);
  const [posts, setPosts] = useState<SnsPostRecord[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [preset, setPreset] = useState<CreatePreset | null>(null);

  const dirty = useRef(false);
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migrating = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubSettings = subscribeSnsSettings(
      (s, pending) => {
        setSettings(s);
        // 自分の編集が未保存の間は、受信した方針で上書きしない
        if (!dirty.current && !pending) setPolicy(s.policy);
        // 旧 settings/sns.posts を sns_posts へ一度だけ写す
        if (!s.postsMigrated && s.legacyPosts.length > 0 && !migrating.current) {
          migrating.current = true;
          migrateLegacyPostsOnce(s.legacyPosts).catch((e) => {
            console.error("sns legacy migration failed", e);
            migrating.current = false;
          });
        }
      },
      () => setLoadError(true)
    );
    const unsubIdeas = subscribeIdeas(setIdeas, () => setLoadError(true));
    const unsubPosts = subscribePosts(setPosts, () => setLoadError(true));
    return () => {
      unsubSettings();
      unsubIdeas();
      unsubPosts();
      // 離れる時に未保存の方針があれば即保存
      if (timer.current) {
        clearTimeout(timer.current);
        if (dirty.current) savePolicy(policyRef.current).catch((e) => console.error("sns policy save failed", e));
      }
    };
  }, []);

  const flush = async () => {
    timer.current = null;
    const snapshot = policyRef.current;
    try {
      await savePolicy(snapshot);
      if (policyRef.current === snapshot) dirty.current = false;
      setSaveState("saved");
    } catch (e) {
      console.error("sns policy save failed", e);
      setSaveState("error");
    }
  };

  // 方針を変えたら少し待ってから自動保存する
  const updatePolicy = (patch: Partial<SnsPolicy>) => {
    if (!settings) return;
    const next = { ...policyRef.current, ...patch };
    policyRef.current = next;
    setPolicy(next);
    dirty.current = true;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  const go = (t: SnsTab) => {
    setTab(t);
    topRef.current?.scrollIntoView({ block: "start" });
  };

  const makeFrom = (p: Omit<CreatePreset, "nonce">) => {
    setPreset({ ...p, nonce: Date.now() });
    go("create");
  };

  const ready = settings !== null;

  return (
    <div className={styles.wrap} ref={topRef}>
      <div className={styles.topBar}>
        <h2 className={styles.h2}>SNS運用</h2>
        <span className={`${styles.saved} ${saveState === "error" ? styles.savedErr : ""}`} aria-live="polite">
          {!ready
            ? "読み込み中…"
            : saveState === "saving"
            ? "保存中…"
            : saveState === "saved"
            ? "保存済み"
            : saveState === "error"
            ? "保存できませんでした。通信を確認してください"
            : ""}
        </span>
      </div>

      <nav className={styles.subTabs} aria-label="SNS運用のメニュー">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`${styles.subTab} ${tab === t.value ? styles.subTabOn : ""}`}
            aria-current={tab === t.value ? "page" : undefined}
            onClick={() => go(t.value)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loadError && <div className={styles.errorBox}>データの読み込みに失敗しました。通信状況を確認して再読み込みしてください。</div>}

      {tab === "today" && <Today policy={policy} posts={posts} ideas={ideas} orders={orders} ready={ready} onGo={go} />}
      {tab === "ideas" && <Ideas ideas={ideas} onMake={makeFrom} />}
      {tab === "create" && <Create policy={policy} posts={posts} ideas={ideas} preset={preset} onLogged={() => go("today")} />}
      {tab === "review" && (
        <Review
          policy={policy}
          posts={posts}
          orders={orders}
          kpt={settings?.kpt ?? {}}
          legacyStats={settings?.legacyStats ?? []}
          ready={ready}
          updatePolicy={updatePolicy}
          onMake={(formatId) => makeFrom({ formatId })}
        />
      )}
      {tab === "knowledge" && <Knowledge onMake={(formatId) => makeFrom({ formatId })} />}
    </div>
  );
}
