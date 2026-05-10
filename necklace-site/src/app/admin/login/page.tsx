import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-session";

const ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "このGoogleアカウントではログインできません。",
  not_configured: "Google OAuth が設定されていません。",
  bad_state: "認証セッションが切れました。もう一度お試しください。",
  missing_code: "認可コードが取得できませんでした。",
  no_email: "メールアドレスが取得できませんでした。",
  bad_audience: "クライアントIDが一致しません。",
  no_id_token: "ID トークンが取得できませんでした。",
  token_exchange_failed: "トークン交換に失敗しました。",
};

type SearchParams = { [k: string]: string | string[] | undefined };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getAdminSession();
  if (session) redirect("/admin");

  const sp = await searchParams;
  const errorKey = typeof sp.error === "string" ? sp.error : "";
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] ?? "ログインに失敗しました。" : "";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white/60 p-8 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-serif font-medium tracking-tight">Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理者専用です。Googleアカウントでログインしてください。
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-md border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/5 px-3 py-2 text-sm text-[var(--accent-red)]">
            {errorMessage}
          </div>
        ) : null}

        <Link
          href="/api/admin/auth/google"
          prefetch={false}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full border border-foreground bg-foreground px-5 py-3 text-sm font-medium tracking-wide text-background transition hover:opacity-90"
        >
          <GoogleMark />
          Sign in with Google
        </Link>

        <p className="mt-6 text-xs text-muted-foreground">
          <Link href="/" className="underline-offset-2 hover:underline">
            ← サイトへ戻る
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.6 6.4 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.6 19 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.6 6.4 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-4.9c-2 1.4-4.4 2.4-6.9 2.4-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.3 5.5l6 4.9c-.4.4 6.5-4.7 6.5-14.4 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
