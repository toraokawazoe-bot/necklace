import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  ORDERS,
  IG_MESSAGES,
  IG_CONVERSATIONS,
  META,
  ORDER_SEQ_DOC,
} from "@/lib/collections";
import { IgConversationDoc, Order } from "@/lib/types";

// このファイルはサーバー専用。Firestore セキュリティルールを認証必須に締めても
// webhook（Meta から来る・Firebase 認証なし）が書けるよう、Admin SDK を使う。
// 既存の orders / settings には手を加えず、DM は専用コレクションに保存する。

// ユーザーネームは変わりうるが、毎メッセージで Graph に問い合わせるのは無駄。
// 同一スレッドでは最後の取得から6時間あけて再取得する。
const USERNAME_RECHECK_MS = 6 * 60 * 60 * 1000;

// ---- Webhook ペイロードの最小型 ----
interface IgAttachment {
  type?: string;
  payload?: { url?: string };
}

interface IgMessage {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  is_deleted?: boolean;
  attachments?: IgAttachment[];
  reply_to?: { story?: { url?: string; id?: string } };
}

interface IgMessaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: IgMessage;
}

interface IgEntry {
  id?: string;
  time?: number;
  messaging?: IgMessaging[];
}

export interface IgWebhookBody {
  object?: string;
  entry?: IgEntry[];
}

/**
 * Meta から届く X-Hub-Signature-256 を検証する。
 * 署名は「sha256=<HMAC-SHA256(appSecret, 生のリクエストボディ)>」。
 */
export function verifyInstagramSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** DM 本文（テキスト or 添付の種別）を日本語の短い文字列にする。 */
function summarizeMessage(m: IgMessage): string {
  if (m.text && m.text.trim()) return m.text.trim();
  if (m.reply_to?.story) return "[ストーリーへの返信]";
  const att = m.attachments?.[0];
  if (att) {
    const labels: Record<string, string> = {
      image: "[画像]",
      video: "[動画]",
      audio: "[音声]",
      file: "[ファイル]",
      share: "[シェア]",
      ig_reel: "[リール]",
      reel: "[リール]",
      story_mention: "[ストーリーメンション]",
    };
    return labels[att.type ?? ""] ?? `[${att.type ?? "添付"}]`;
  }
  return "[メッセージ]";
}

/**
 * 送信者のユーザー名を取得（INSTAGRAM_ACCESS_TOKEN が設定されている場合のみ）。
 * 未設定なら null を返し、呼び出し側で IGSID を使う。
 */
async function resolveUsername(igsid: string): Promise<string | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://graph.instagram.com/${encodeURIComponent(
        igsid
      )}?fields=username,name&access_token=${encodeURIComponent(token)}`
    );
    if (!res.ok) {
      // トークン失効(190)・権限不足・レート制限などをここで握り潰すと
      // 「IG:<番号>」表示に化けて原因が分からなくなるため、必ずログに残す。
      // ※ URL にトークンが入るので URL 自体はログしない。
      console.error(
        `[instagram resolveUsername] failed status=${res.status} igsid=${igsid}`
      );
      return null;
    }
    const j = (await res.json()) as { username?: string; name?: string };
    if (j.username) return `@${j.username}`;
    if (j.name) return j.name;
    return null;
  } catch (e) {
    console.error(`[instagram resolveUsername] network error igsid=${igsid}`, e);
    return null;
  }
}

// ---- DM 送信（返信） ----
// Instagram ログイン版の Send API。ホストは graph.instagram.com（facebook.com ではない）。
const SEND_ENDPOINT = "https://graph.instagram.com/v23.0/me/messages";

export interface SendError {
  code?: string | number;
  error_subcode?: number;
  message?: string;
  type?: string;
}

export type SendResult =
  | { ok: true; messageId: string; recipientId: string }
  | { ok: false; status: number; error: SendError };

/**
 * 相手（IGSID）へテキスト DM を送る。
 * - トークンは INSTAGRAM_ACCESS_TOKEN（サーバー専用・instagram_business_manage_messages 権限が必要）。
 * - 標準メッセージウィンドウ（相手の最終 DM から 24 時間以内）でのみ成功する。
 * - 失敗時は Graph のエラー本体（{code, error_subcode, ...}）を unwrap して返す。
 */
export async function sendInstagramMessage(
  recipientId: string,
  text: string
): Promise<SendResult> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    return { ok: false, status: 500, error: { code: "no_token" } };
  }
  try {
    const res = await fetch(SEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      recipient_id?: string;
      message_id?: string;
      error?: SendError;
    };
    if (!res.ok) {
      // Graph のエラー本体（code/error_subcode/message）をサーバーログに残す。
      // トークンは含めない（error 本体に token は入らない）。
      console.error(
        `[instagram send] failed status=${res.status}`,
        j.error ?? "no_error_body"
      );
      return {
        ok: false,
        status: res.status,
        error: j.error ?? { message: "unknown_error" },
      };
    }
    return {
      ok: true,
      messageId: j.message_id ?? "",
      recipientId: j.recipient_id ?? recipientId,
    };
  } catch (e) {
    console.error("[instagram send] network error", e);
    return { ok: false, status: 502, error: { code: "network" } };
  }
}

/** 1 件の受信メッセージを処理する。 */
async function processIncomingMessage(
  entryId: string,
  msg: IgMessaging
): Promise<void> {
  const m = msg.message;
  if (!m) return;
  // 自分（ショップ）が送ったメッセージのエコー / 削除通知はカードを作らない
  if (m.is_echo || m.is_deleted) return;

  const senderId = msg.sender?.id;
  if (!senderId) return;

  const ts = msg.timestamp ?? Date.now();
  const mid = m.mid ?? `${senderId}_${ts}`;

  const db = getAdminDb();

  // 冪等性: 同じメッセージ ID を二重処理しない（Meta は失敗時に再送する）
  const msgRef = db.collection(IG_MESSAGES).doc(mid);
  const already = await msgRef.get();
  if (already.exists) return;

  const summary = summarizeMessage(m);

  // メッセージ本体（兼・冪等マーカー）はこの時点では書かない。
  // 受注カード／会話の作成が失敗したのに mid だけ先に記録されると、Meta の再送が
  // already.exists() で弾かれ、その DM が二度とカード化されず無言で取りこぼされる。
  // → カード／会話を確定させた「後」に、最後に書く（下部の setDoc(msgRef) 参照）。
  const messageDoc = {
    id: mid,
    threadId: senderId,
    senderId,
    recipientId: msg.recipient?.id ?? entryId ?? "",
    text: m.text ?? "",
    summary,
    attachments: (m.attachments ?? []).map((a) => ({
      type: a.type ?? "",
      url: a.payload?.url ?? "",
    })),
    ts,
    createdAt: Date.now(),
    direction: "in" as const,
  };

  // スレッド（= 送信者）ごとに受注カードは 1 枚だけ作る。
  // 2 通目以降は会話メタの更新のみ。既存カードの手動編集は一切上書きしない。
  const convRef = db.collection(IG_CONVERSATIONS).doc(senderId);
  const convSnap = await convRef.get();

  if (!convSnap.exists) {
    // スレッドの初回メッセージ。受注カードと会話ドキュメントをトランザクションで
    // 原子的に作成し、同一送信者の初回 DM が並行到着してもカードが二重に立たない
    // ようにする（getDoc→setDoc の TOCTOU を塞ぐ）。
    // ※ 通信（ユーザーネーム取得）はトランザクション外で行う。トランザクション関数は
    //   競合時に再実行されうるため、副作用のあるネットワーク呼び出しを入れない。
    const handle = await resolveUsername(senderId); // "@xxx" | 表示名 | null
    const customer = handle ?? `IG:${senderId}`;
    const orderId = `o_ig_${senderId}_${ts}`;
    const seqRef = db.collection(META).doc(ORDER_SEQ_DOC);
    await db.runTransaction(async (tx) => {
      // トランザクションは全 read を全 write より前に行う必要があるため、
      // 会話とカウンタの取得をここでまとめて済ませる。
      const fresh = await tx.get(convRef);
      const seqSnap = await tx.get(seqRef);
      if (fresh.exists) {
        // 競合した別イベントが先に会話を作成済み。カードは作らずメタだけ更新する。
        // messageCount は else 経路と揃えて原子インクリメントで数える。
        tx.set(
          convRef,
          {
            lastText: summary,
            lastTs: ts,
            messageCount: FieldValue.increment(1),
            updatedAt: Date.now(),
          },
          { merge: true }
        );
        return;
      }
      // カウンタが既に初期化済みのときだけ採番する。未初期化（運用者がまだ一度も
      // アプリを開いていない初回デプロイ直後など）や next が壊れている場合は番号を
      // 振らずに置き、運用者の次回ロードの backfill が created 昇順でまとめて採番する。
      // こうすることで「カウンタ doc を作るのは backfill だけ」という不変条件を保ち、
      // 採番順が受注順とズレるのを防ぐ。壊れた next を ?? 1 で握りつぶすと #1 を
      // 再発番して重複するため、有限数のときだけ採番する。
      const rawNext = seqSnap.exists ? seqSnap.data()?.next : undefined;
      const orderNo =
        typeof rawNext === "number" && Number.isFinite(rawNext)
          ? rawNext
          : undefined;
      const order: Order = {
        id: orderId,
        created: ts,
        customer,
        type: "",
        length: "",
        adjuster: "",
        design: "",
        payment: "",
        status: "問い合わせ中",
        needsResponse: true,
        memo: `【Instagram DM】\n${summary}`,
        source: "instagram",
        igThreadId: senderId,
        igSenderId: senderId,
        ...(handle ? { igUsername: handle } : {}),
        ...(orderNo != null ? { orderNo } : {}),
      };
      if (orderNo != null) {
        tx.set(seqRef, { next: orderNo + 1 }, { merge: true });
      }
      tx.set(db.collection(ORDERS).doc(orderId), order);
      tx.set(convRef, {
        threadId: senderId,
        orderId,
        customer,
        igUsername: handle ?? "",
        igUsernameCheckedAt: Date.now(),
        igUsernameHistory: [],
        lastText: summary,
        lastTs: ts,
        messageCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  } else {
    const data = (convSnap.data() ?? {}) as IgConversationDoc;

    const convUpdate: Record<string, unknown> = {
      lastText: summary,
      lastTs: ts,
      // 同一スレッドの 2 通目以降が並行到着しても取りこぼさないよう、
      // read-modify-write ではなくサーバー側の原子インクリメントで数える。
      messageCount: FieldValue.increment(1),
      updatedAt: Date.now(),
    };

    // ユーザーネームの変更追跡。一定間隔をあけて現在の @handle を再取得し、
    // 変わっていたら旧名を履歴に積んで現在名を更新する（誰か分からなくなるのを防ぐ）。
    const checkedAt = data.igUsernameCheckedAt ?? 0;
    if (Date.now() - checkedAt > USERNAME_RECHECK_MS) {
      const handle = await resolveUsername(senderId);
      convUpdate.igUsernameCheckedAt = Date.now();
      if (handle && handle !== data.igUsername) {
        const prevAuto = data.igUsername; // これまでの自動取得ユーザーネーム
        const history = data.igUsernameHistory ?? [];
        const nextHistory = prevAuto
          ? [...history, { username: prevAuto, ts: Date.now() }]
          : history;
        convUpdate.igUsername = handle;
        convUpdate.igUsernameHistory = nextHistory;

        // 受注カードにも反映する。ただし表示名（customer）は owner が手で
        // 編集している場合があるので、自動取得値のままのときだけ追従する。
        if (data.orderId) {
          const orderRef = db.collection(ORDERS).doc(data.orderId);
          const orderUpdate: Record<string, unknown> = {
            igUsername: handle,
            igUsernameHistory: nextHistory,
          };
          const orderSnap = await orderRef.get();
          const orderData = orderSnap.exists
            ? (orderSnap.data() as Order)
            : null;
          // owner が表示名を変えていない（旧ユーザーネーム / IGSID フォールバック /
          // 空欄のまま）なら新しいユーザーネームに追従させる。
          const igFallback = `IG:${senderId}`;
          const untouched =
            !!orderData &&
            (orderData.customer === prevAuto ||
              orderData.customer === igFallback ||
              !orderData.customer);
          if (untouched) {
            orderUpdate.customer = handle;
            convUpdate.customer = handle;
          }
          await orderRef.set(orderUpdate, { merge: true });
        }
      }
    }

    await convRef.set(convUpdate, { merge: true });
  }

  // カード／会話が確定したので、最後にメッセージ本体（兼・冪等マーカー）を書く。
  // ここまでで例外が出ていれば mid は未記録のままなので、Meta の再送で再処理される。
  // ※ この設計上、ごく稀（会話更新の成功後〜この書き込みの間でクラッシュ）に再処理が
  //   走ると messageCount が二重加算されうる。messageCount は表示専用の目安であり、
  //   「無言の取りこぼし」を避けるためのトレードオフとして許容する。
  await msgRef.set(messageDoc);
}

/** Webhook の POST ボディを処理する。Instagram 以外のイベントは無視。 */
export async function handleInstagramEvent(body: IgWebhookBody): Promise<void> {
  if (!body || body.object !== "instagram" || !Array.isArray(body.entry)) return;
  for (const entry of body.entry) {
    const events = entry.messaging ?? [];
    for (const ev of events) {
      // 1 イベントの失敗で同一バッチの後続メッセージを巻き込まないよう、個別に隔離する。
      try {
        await processIncomingMessage(entry.id ?? "", ev);
      } catch (e) {
        console.error("[instagram event] processing failed", e);
      }
    }
  }
}
