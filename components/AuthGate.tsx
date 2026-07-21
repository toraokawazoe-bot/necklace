"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { REQUIRE_AUTH, subscribeAuth, login, resetPassword } from "@/lib/authClient";
import styles from "./AuthGate.module.css";

// ログイン失敗の原因ごとにメッセージを分ける（送信APIのigErrorMessageと同じ考え方）。
// 一律「メール/パスワードが違います」だと、ネットワーク障害や設定ミスも本人のせいに見えてしまう。
function loginErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? "";
  if (code === "auth/network-request-failed")
    return "ネットワークエラーでログインできませんでした。電波を確認して再度お試しください。";
  if (code === "auth/too-many-requests")
    return "ログイン試行が多すぎるため、一時的にブロックされています。しばらく待ってから再度お試しください。";
  if (code === "auth/user-disabled")
    return "このアカウントは無効化されています。管理者にご連絡ください。";
  if (
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-credential" ||
    code === "auth/invalid-email"
  )
    return "メールアドレスかパスワードが正しくありません。";
  return "ログインに失敗しました。時間をおいて再度お試しください。";
}

// 認証が必須のとき、ログイン済みのときだけ children（アプリ本体）を表示する。
// NEXT_PUBLIC_REQUIRE_AUTH が未設定なら素通し（従来どおりの挙動）。
export default function AuthGate({ children }: { children: React.ReactNode }) {
  // 認証不要なら最初から ready。必須なら onAuthStateChanged の初回確定を待つ。
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!REQUIRE_AUTH);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!REQUIRE_AUTH) return;
    const unsub = subscribeAuth((u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!REQUIRE_AUTH) return <>{children}</>;
  if (!ready) {
    return <div className={styles.center}>読み込み中…</div>;
  }
  if (user) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // onAuthStateChanged が user を更新し、自動的に children へ切り替わる。
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetting) return;
    if (!email.trim()) {
      alert("先にメールアドレスを入力してください。");
      return;
    }
    setResetting(true);
    try {
      await resetPassword(email.trim());
      alert(
        `${email.trim()} 宛にパスワード再設定メールを送信しました。届いたメールの案内に従って再設定してください。`
      );
    } catch {
      alert("再設定メールの送信に失敗しました。メールアドレスを確認して再度お試しください。");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={styles.center}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>オーダー管理</h1>
        <p className={styles.subtitle}>ログインしてください</p>
        <input
          className={styles.input}
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={styles.input}
          type="password"
          autoComplete="current-password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? "ログイン中…" : "ログイン"}
        </button>
        <button
          type="button"
          className={styles.resetLink}
          onClick={handleResetPassword}
          disabled={resetting}
        >
          {resetting ? "送信中…" : "パスワードをお忘れの方はこちら"}
        </button>
      </form>
    </div>
  );
}
