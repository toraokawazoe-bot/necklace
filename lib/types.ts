export type OrderStatus =
  | "問い合わせ中"
  | "受注確定"
  | "制作中"
  | "制作済み"
  | "配送中"
  | "納品"
  | "失注";

export type ItemType = "ネックレス" | "ブレスレット" | "";

export type PaymentMethod = "PayPay" | "銀行振込" | "その他" | "";

// 配送業者。追跡URL生成・通知文に使う（storefront の Carrier 型と整合）。
export type Carrier =
  | "japanpost_clickpost"
  | "japanpost_yupacket"
  | "japanpost_yupack"
  | "japanpost_letter"
  | "yamato"
  | "sagawa"
  | "other"
  | "";

// 配送業者ドロップダウンの選択肢（storefront の ShipControls と整合）。
// 空欄（未選択）は select 側の固定 option で扱い、ここには含めない。
export const CARRIER_OPTIONS: { value: Exclude<Carrier, "">; label: string }[] = [
  { value: "japanpost_clickpost", label: "クリックポスト" },
  { value: "japanpost_yupacket", label: "ゆうパケット" },
  { value: "japanpost_yupack", label: "ゆうパック" },
  { value: "japanpost_letter", label: "定形外郵便（追跡なし）" },
  { value: "yamato", label: "ヤマト運輸" },
  { value: "sagawa", label: "佐川急便" },
  { value: "other", label: "その他" },
];

// 配送業者の短い表示名。storefront の carrierLabel と整合（未選択は "—"）。
export function carrierLabel(carrier: Carrier | undefined): string {
  switch (carrier) {
    case "japanpost_clickpost":
      return "クリックポスト";
    case "japanpost_yupacket":
      return "ゆうパケット";
    case "japanpost_yupack":
      return "ゆうパック";
    case "japanpost_letter":
      return "定形外郵便";
    case "yamato":
      return "ヤマト運輸";
    case "sagawa":
      return "佐川急便";
    case "other":
      return "その他";
    default:
      return "—";
  }
}

// 配送業者＋追跡番号から各社の追跡ページURLを生成。番号なし・追跡非対応は null。
// storefront の trackingUrl と整合。
export function trackingUrl(
  carrier: Carrier | undefined,
  trackingNumber: string | undefined,
): string | null {
  if (!trackingNumber) return null;
  const tn = encodeURIComponent(trackingNumber);
  switch (carrier) {
    case "japanpost_clickpost":
    case "japanpost_yupacket":
    case "japanpost_yupack":
      return `https://trackings.post.japanpost.jp/services/srv/search/direct?reqCodeNo1=${tn}&locale=ja`;
    // japanpost_letter（定形外郵便）は追跡番号がないので default→null（ラベルの「追跡なし」と整合）。
    case "yamato":
      return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number01=${tn}`;
    case "sagawa":
      return `https://k2k.sagawa-exp.co.jp/p/web/okurijostate?okurijoNo=${tn}`;
    default:
      return null;
  }
}

export interface Order {
  id: string;
  created: number;
  // 受注の通し番号（受注順＝古い順で 1,2,3…）。受注した瞬間に固定で振られ、
  // 他の注文を削除しても変わらない。お客さんとの会話・伝票番号にも使える。
  // 旧データは初回ロードのマイグレーションで created 昇順に採番される。
  orderNo?: number;
  customer: string;
  type: ItemType;
  length: string;
  design: string;
  payment: PaymentMethod;
  status: OrderStatus;
  memo: string;
  screenshot?: string;
  // 個別の金額上書き（未入力なら受注月のデフォルト価格を使用）
  priceOverride?: number;
  // 新規DM自動作成／クイック追加の直後は true。フォームを開いて保存した時点で
  // false（対応済み）にする。旧「受信トレイ」ステータスが持っていた「未対応の
  // 新着」という緊急度シグナルを、ステータスとは独立に持たせるためのフラグ。
  needsResponse?: boolean;
  // status が "受注確定" に達したタイミング（前払い＝入金確認できた瞬間）でスタンプ。
  // 受注確定以降のどの段階でも保持し続け、受注確定より手前に戻されたときだけ消す。
  paidAt?: number;
  // status が "納品" になったタイミングでスタンプ（配達完了）。paidAt とは別軸。
  deliveredAt?: number;
  // --- Instagram DM 連携 ---
  // "instagram" = DM から自動生成されたカード（未設定 or "manual" = 手動入力）
  source?: "instagram" | "manual";
  // 同一DMスレッドで二重にカードを作らないための識別子（送信者の IGSID）
  igThreadId?: string;
  igSenderId?: string;
  // 相手の「現在の」ユーザーネーム（@handle）。Instagram では変更されうる。
  // 本人の不変の鍵は igSenderId（IGSID）であり、これは表示用の最新値。
  igUsername?: string;
  // ユーザーネーム変更履歴（古い順）。改名のたびに「変更前の名前」を積む。
  // これがあると、相手が改名しても誰だったか辿れる。
  igUsernameHistory?: { username: string; ts: number }[];
  // --- 発送先・配送 ---
  // 住所はこれまでメモ/DM/記憶に散在していた。構造化して「宛先コピー」や検索を効かせる。
  shippingName?: string; // 宛名（本名。customer はあだ名/IDのことが多い）
  postalCode?: string;
  address?: string;
  phone?: string;
  carrier?: Carrier; // 配送業者（追跡URL生成・通知文に使う）
  trackingNumber?: string; // 追跡番号（「届いた?」に即答するため）
  shippedAt?: number; // 発送日。paidAt/deliveredAtとは別軸
}

// Instagram DM の 1 メッセージ（ig_messages コレクションの 1 ドキュメント）。
// 書き込みは lib/instagram.ts、読み出しは注文詳細の会話ログで使う。
export interface IgMessageDoc {
  id: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  text: string;
  summary: string;
  attachments: { type: string; url: string }[];
  ts: number;
  createdAt: number;
  // "in" = お客様からの受信 / "out" = ショップからの返信。
  // 旧データには無い項目。未設定は "in"（受信）として扱う。
  direction?: "in" | "out";
}

// Instagram DM スレッドのメタ情報（ig_conversations コレクションの1ドキュメント）。
// 書き込みは lib/instagram.ts（webhook）と送信API。1スレッド=1ドキュメント。
export interface IgConversationDoc {
  threadId: string;
  orderId?: string;
  customer?: string;
  // 現在の @username と、その最終取得時刻・変更履歴
  igUsername?: string;
  igUsernameCheckedAt?: number;
  igUsernameHistory?: { username: string; ts: number }[];
  // 受信プレビュー
  lastText?: string;
  lastTs?: number;
  // ショップからの返信プレビュー（受信側を上書きしないため分離）
  lastOutText?: string;
  lastOutTs?: number;
  messageCount?: number;
  createdAt?: number;
  updatedAt?: number;
}

export const STATUS_LIST: OrderStatus[] = [
  "問い合わせ中",
  "受注確定",
  "制作中",
  "制作済み",
  "配送中",
  "納品",
  "失注",
];

// ステータスを1段階進める流れ（失注は対象外、納品が終点）。
export const ADVANCE_FLOW: OrderStatus[] = [
  "問い合わせ中",
  "受注確定",
  "制作中",
  "制作済み",
  "配送中",
  "納品",
];

// 次に進むステータス。終点（完了）や対象外（失注）は null。
export function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = ADVANCE_FLOW.indexOf(s);
  if (i === -1 || i === ADVANCE_FLOW.length - 1) return null;
  return ADVANCE_FLOW[i + 1];
}

export interface MonthlyPrice {
  necklace?: number;
  bracelet?: number;
}

export interface Settings {
  // キーは "YYYY-MM"（例：2026-04）
  monthlyPrices: Record<string, MonthlyPrice>;
}

export const EMPTY_SETTINGS: Settings = {
  monthlyPrices: {},
};
