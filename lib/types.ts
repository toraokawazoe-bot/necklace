export type OrderStatus =
  | "問い合わせ中"
  | "受注確定"
  | "制作中"
  | "制作済み"
  | "配送中"
  | "納品"
  | "失注";

export type ItemType = "ネックレス" | "ブレスレット" | "";

// チェーンの長さ調整金具（アジャスター）を付けるかどうか。
export type Adjuster = "あり" | "なし" | "";

// 注文がどこから来たか。月ごとに数えて、どこに時間を使うかを決めるために記録する。
export type Channel = "Instagram" | "TikTok" | "スレッズ" | "ポップアップ" | "知り合い" | "その他" | "";

export const CHANNEL_OPTIONS: Exclude<Channel, "">[] = [
  "Instagram",
  "TikTok",
  "スレッズ",
  "ポップアップ",
  "知り合い",
  "その他",
];

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
  adjuster: Adjuster;
  design: string;
  payment: PaymentMethod;
  // どこから来た注文か。未設定は「未選択」として数える。
  channel?: Channel;
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

// ---- SNS運用タブ ----
// 保存先: Firestore settings/sns（既存の settings コレクション内。ルール変更不要）
export type SnsPlatform = "tiktok" | "igFeed" | "igStory";

export const SNS_PLATFORM_LABEL: Record<SnsPlatform, string> = {
  tiktok: "TikTok",
  igFeed: "Instagramフィード・リール",
  igStory: "ストーリーズ",
};

export interface SnsContentType {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
}

export interface SnsPost {
  id: string;
  ts: number;
  platform: SnsPlatform;
  contentType: string; // SnsContentType.label
  memo: string;
}

// 毎週の数字。未入力は null。
export interface SnsWeeklyStat {
  weekStart: string; // その週の月曜 "YYYY-MM-DD"（日本時間）
  tiktokViews: number | null;
  tiktokSaves: number | null;
  tiktokSearchPct: number | null;
  igReelSends: number | null;
  igReelReach: number | null;
  igProfileVisits: number | null;
  igLinkTaps: number | null;
  memo: string;
}

export interface SnsPlanData {
  tiktokPerWeek: number;
  tiktokVideoPerWeek: number;
  igFeedPerWeek: number;
  igReelPerWeek: number;
  igStoryPerDay: number;
  postTime: string;
  restDay: string;
  contentTypes: SnsContentType[];
  keywords: string[];
  posts: SnsPost[];
  stats: Record<string, SnsWeeklyStat>;
}

// ---- SNS運用タブ(2026-10 作り直し) ----
// 方針: settings/sns の policy / kpt フィールド。
// アイデア: sns_ideas コレクション(1件=1ドキュメント)。スクショ本体は sns_idea_images/{ideaId}。
// 投稿記録: sns_posts コレクション(1件=1ドキュメント)。
// 旧データ(settings/sns の posts / stats ほか)は消さずに残す。posts は sns_posts へ一度だけ写す。

// 投稿した場所
export type SnsPlace = "tiktokPhoto" | "tiktokVideo" | "igFeed" | "igReel" | "igStory";

export const SNS_PLACES: SnsPlace[] = ["tiktokPhoto", "tiktokVideo", "igFeed", "igReel", "igStory"];

export const SNS_PLACE_LABEL: Record<SnsPlace, string> = {
  tiktokPhoto: "TikTok写真",
  tiktokVideo: "TikTok動画",
  igFeed: "Instagramフィード",
  igReel: "リール",
  igStory: "ストーリーズ",
};

export function isTikTok(p: SnsPlace): boolean {
  return p === "tiktokPhoto" || p === "tiktokVideo";
}
export function isInstagramPost(p: SnsPlace): boolean {
  return p === "igFeed" || p === "igReel";
}

export type SnsIdeaStatus = "未仕分け" | "採用" | "投稿済み" | "却下";
export const SNS_IDEA_STATUSES: SnsIdeaStatus[] = ["未仕分け", "採用", "投稿済み", "却下"];

export type SnsEffort = "S" | "M" | "L" | "";

export interface SnsIdea {
  id: string;
  created: number;
  updated?: number;
  text: string;
  url?: string;
  // スクショがあるか。本体は sns_idea_images/{id} の data(画像のdataURL)。
  hasImage?: boolean;
  source: "app" | "ios-share";
  status: SnsIdeaStatus;
  formatId?: string; // 型カードの id(lib/snsKnowledge.ts)
  season?: string;
  effort?: SnsEffort;
  impact?: number | null; // 影響 1〜5
  ease?: number | null; // 手軽さ 1〜5
  postId?: string; // 投稿済みにした投稿
}

export interface SnsPostRecord {
  id: string;
  ts: number; // 投稿日時
  place: SnsPlace;
  formatId?: string;
  formatLabel: string;
  hook?: string;
  keyword?: string;
  ideaId?: string;
  memo?: string;
  wearing?: boolean; // 1枚目に人が着けた姿
  notice?: boolean; // 告知・販売の投稿
  views: number | null;
  saves: number | null;
  legacy?: boolean; // 旧 settings/sns.posts から写したもの
}

export type SnsWeekday = "月" | "火" | "水" | "木" | "金" | "土" | "日";
export const SNS_WEEKDAYS: SnsWeekday[] = ["月", "火", "水", "木", "金", "土", "日"];

export interface SnsPolicy {
  tiktokPerWeek: number;
  igPerWeek: number;
  igReelPerWeek: number;
  storiesPerDay: number;
  wearingMinPct: number; // 「人が着けた姿」を何%以上
  noticeMaxPerWeek: number;
  postTime: string;
  restDays: SnsWeekday[];
  schedule: Record<SnsWeekday, SnsPlace[]>; // 曜日ごとの予定投稿
  pillars: { wear: number; buy: number; daily: number; learn: number }; // 型の割合(%)
  keywords: string[];
}

export interface SnsKpt {
  keep: string;
  problem: string;
  try: string;
}
