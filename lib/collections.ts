// Firestore のコレクション名／固定ドキュメントIDを一箇所に集約する。
// 以前は lib/instagram.ts・lib/storage.ts・送信APIに同じ文字列が重複定義されており、
// 片方だけ変更する事故や typo の温床だった。参照はすべてここから。
export const ORDERS = "orders";
export const IG_MESSAGES = "ig_messages";
export const IG_CONVERSATIONS = "ig_conversations";
export const SETTINGS = "settings";
export const META = "meta";

// 固定ドキュメントID
export const SETTINGS_DOC = "main";
export const SEED_META_DOC = "seed";
