export type OrderStatus =
  | "受信トレイ"
  | "問い合わせ中"
  | "制作中"
  | "支払い待ち"
  | "発送待ち"
  | "完了"
  | "失注";

export type ItemType = "ネックレス" | "ブレスレット" | "";

export type PaymentMethod = "PayPay" | "銀行振込" | "その他" | "";

export interface Order {
  id: string;
  created: number;
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
  // status === "完了" になったタイミング。着金日として扱う
  completedAt?: number;
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

export const STATUS_LIST: OrderStatus[] = [
  "受信トレイ",
  "問い合わせ中",
  "制作中",
  "支払い待ち",
  "発送待ち",
  "完了",
  "失注",
];

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
