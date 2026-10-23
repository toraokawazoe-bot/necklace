// そのタブで最初にサイトへ来た時の流入元(ホスト名だけ)を覚えておく。
// 決済を作る時に一緒に送り、止まった決済の「どこから来た人か」に使う。個人情報は入らない。
const KEY = "_ref0";

export function rememberFirstRef(): void {
  try {
    if (sessionStorage.getItem(KEY)) return;
    let host = "(direct)";
    if (document.referrer) {
      const h = new URL(document.referrer).hostname.replace(/^www\./, "").toLowerCase();
      if (h && h !== location.hostname.replace(/^www\./, "").toLowerCase()) host = h;
    }
    sessionStorage.setItem(KEY, host);
  } catch {
    // ストレージが使えない環境では何もしない
  }
}

export function readFirstRef(): string | undefined {
  try {
    return sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
