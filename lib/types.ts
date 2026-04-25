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
