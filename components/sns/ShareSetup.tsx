"use client";

import { useEffect, useState } from "react";
import { getIdToken } from "@/lib/authClient";
import { CopyButton } from "./common";
import styles from "../SnsPlan.module.css";

// 「共有ボタンの設定」画面。iOSショートカットの作り方と、貼り付けるURL・トークンを出す。
// トークンはサーバーの環境変数 IDEAS_TOKEN にあり、/api/ideas/token から受け取る(ブラウザには保存しない)。
export default function ShareSetup({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "ok" | "ng">("idle");
  const [endpoint, setEndpoint] = useState("https://necklace-48ca.vercel.app/api/ideas");

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/ideas`);
    (async () => {
      try {
        const idToken = await getIdToken().catch(() => null);
        const res = await fetch("/api/ideas/token", {
          method: "POST",
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
          cache: "no-store",
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string; error?: string };
        if (res.ok && body.token) setToken(body.token);
        else setError(body.error === "not_configured" ? "サーバーにトークンが設定されていません" : "トークンを読み込めませんでした");
      } catch {
        setError("トークンを読み込めませんでした。通信状況を確認してください");
      }
    })();
  }, []);

  const test = async () => {
    if (!token) return;
    setTestState("sending");
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, text: "共有ボタンのテスト(削除してOK)" }),
      });
      setTestState(res.ok ? "ok" : "ng");
    } catch {
      setTestState("ng");
    }
  };

  const masked = token ? token.slice(0, 4) + "•".repeat(12) + token.slice(-4) : "";

  return (
    <section className={styles.card}>
      <div className={styles.topBar}>
        <h3 className={styles.h3}>共有ボタンの設定</h3>
        <button type="button" className={styles.secondary} onClick={onClose}>
          ‹ 戻る
        </button>
      </div>
      <div className={styles.note}>
        iPhoneの共有ボタンから、見つけた投稿のURLと一言をそのままアイデア箱に送れるようにします。とらおも同じショートカットを入れれば2人とも送れます。
      </div>

      <div className={styles.fieldTitle}>貼り付けるURL</div>
      <div className={styles.codeBox}>{endpoint}</div>
      <CopyButton text={endpoint} label="URLをコピー" />

      <div className={styles.fieldTitle}>トークン(合言葉)</div>
      {error && <div className={styles.warnText}>{error}</div>}
      {!token && !error && <div className={styles.note}>読み込み中…</div>}
      {token && (
        <>
          <div className={styles.codeBox}>{reveal ? token : masked}</div>
          <div className={styles.addRow}>
            <CopyButton text={token} label="トークンをコピー" />
            <button type="button" className={styles.secondary} onClick={() => setReveal((v) => !v)}>
              {reveal ? "隠す" : "表示"}
            </button>
          </div>
          <div className={styles.note}>トークンは合言葉です。ショートカットの中にだけ貼り、ほかの人には送らないでください。</div>
        </>
      )}

      <div className={styles.fieldTitle}>ショートカットの作り方</div>
      <ol className={styles.steps}>
        <li>「ショートカット」アプリを開き、右上の「+」で新規を作る</li>
        <li>
          下の「i」(詳細)で<strong>「共有シートに表示」をオン</strong>。受け取る種類は<strong>「URL」と「テキスト」</strong>だけにする
        </li>
        <li>
          アクション<strong>「入力を要求」</strong>を追加(質問:「ひとこと」)
        </li>
        <li>
          アクション<strong>「URLの内容を取得」</strong>を追加。URLに上の<strong>URLを貼る</strong>
        </li>
        <li>
          そのアクションの詳細を開いて、<strong>方法=POST</strong>、<strong>本文を要求=JSON</strong>
        </li>
        <li>
          「新規フィールドを追加」→「テキスト」で3つ作る
          <ul className={styles.plainList}>
            <li>
              キー <code>token</code> → 値に<strong>トークンを貼る</strong>
            </li>
            <li>
              キー <code>url</code> → 値は変数<strong>「ショートカットの入力」</strong>
            </li>
            <li>
              キー <code>text</code> → 値は変数<strong>「入力を要求」で入れた文</strong>
            </li>
          </ul>
        </li>
        <li>(なくてもOK)アクション「通知を表示」で「アイデア箱に入れました」</li>
        <li>
          名前を<strong>「740にメモ」</strong>にして完了
        </li>
      </ol>
      <div className={styles.note}>
        使い方:TikTok・Instagram・Safariで共有ボタン →「740にメモ」→ 一言を入れる。アイデア箱の「未仕分け」に入ります。
        文章は500文字まで、URLは http(s) で始まる1000文字までです。
      </div>

      <div className={styles.fieldTitle}>送れるか試す</div>
      <button type="button" className={styles.secondary} onClick={test} disabled={!token || testState === "sending"}>
        {testState === "sending" ? "送っています…" : "テストで1件送る"}
      </button>
      {testState === "ok" && <div className={styles.okText}>届きました。アイデア箱の「未仕分け」に「共有ボタンのテスト」が入っています(削除してOK)。</div>}
      {testState === "ng" && <div className={styles.warnText}>送れませんでした。時間をおいてもう一度試してください。</div>}
    </section>
  );
}
