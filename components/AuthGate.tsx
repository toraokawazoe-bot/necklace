"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { REQUIRE_AUTH, subscribeAuth, login } from "@/lib/authClient";
import styles from "./AuthGate.module.css";

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
    } catch {
      setError("メールアドレスかパスワードが正しくありません。");
    } finally {
      setSubmitting(false);
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
      </form>
    </div>
  );
}
