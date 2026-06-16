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
