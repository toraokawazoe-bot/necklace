import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import { app } from "./firebase";

// クライアント（ブラウザ）専用の Firebase Auth。
// 運用者のみがログインして注文データにアクセスできるようにするための土台。
// 認証を有効化するかは NEXT_PUBLIC_REQUIRE_AUTH=1 で切り替える（設定完了まで dormant）。
export const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === "1";

export const auth = getAuth(app);

// 端末にログインを保持（毎回ログインさせない）。失敗しても致命的でないので握り潰す。
setPersistence(auth, browserLocalPersistence).catch(() => {});

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

// 送信 API 呼び出しに添える ID トークン（未ログインなら null）。
// forceRefresh=true で失効済みトークンを更新してから返す。
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const u = auth.currentUser;
  return u ? u.getIdToken(forceRefresh) : null;
}
