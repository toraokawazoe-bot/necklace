# Instagram DM 連携 セットアップ手順

受注システムに、インスタDMを自動で取り込む機能のセットアップ手順です。
**コード側はすでに実装済み**。あとは下記の Meta 側の設定とキーの登録だけで繋がります。

## 全体像

```
インスタDM受信
   ↓ Webhook（リアルタイム通知）
/api/instagram/webhook   ← このリポジトリに実装済み
   ↓ 保存
Firestore（ig_messages / ig_conversations コレクション）
   ↓ 受注カードを自動生成（orders コレクションに新規追加）
受信トレイに自動で並ぶ
```

- 既存の `orders` / `settings` データには一切触れません（新規追加のみ）。
- DM 1スレッドにつき受注カードは1枚だけ自動生成。2通目以降は会話ログのみ更新し、カードの手動編集は上書きしません。

## あなたがやること

### 1. インスタをビジネスアカウントにする（未対応なら）
プロアカウントの中でも「ビジネス」にしておくとメッセージ権限の審査が通りやすいです（無料・アプリ内で切替）。

### 2. Meta アプリを作成
1. https://developers.facebook.com → 「マイアプリ」→ アプリを作成（タイプ：ビジネス）
2. プロダクトに **Instagram** を追加 → 「Instagram API setup with Instagram login」を選択
3. インスタのプロアカウントを連携

### 3. Webhook を登録
- コールバックURL：`https://<あなたのVercel本番URL>/api/instagram/webhook`
  - 例：`https://necklace-48ca.vercel.app/api/instagram/webhook`（独自ドメインがあればそちら）
- 検証トークン：自分で決めた文字列（後述の `INSTAGRAM_VERIFY_TOKEN` と同じ値）
- 購読フィールド：**messages** にチェック（必要に応じて message_reactions / messaging_postbacks も）

### 4. キーを環境変数に登録
Vercel のプロジェクト設定（Settings → Environment Variables）と、ローカルの `.env.local` に追加：

| 変数名 | 値 | 必須 |
|--------|-----|------|
| `INSTAGRAM_VERIFY_TOKEN` | 手順3で決めた合言葉と同じ文字列 | ✅（Webhook検証に必要） |
| `INSTAGRAM_APP_SECRET` | Meta アプリの App Secret | ✅（本番の署名検証に必要） |
| `INSTAGRAM_ACCESS_TOKEN` | 長期アクセストークン | 任意（送信者名の自動取得に使用） |

> 開発中（自分のアカウントでテスト）なら `INSTAGRAM_APP_SECRET` 未設定でも動きます（署名検証をスキップ）。本番では必ず設定してください。

### 5. 本番運用には App Review
実際のお客さんのDMを扱うには、`instagram_business_manage_messages` の **App Review（アプリ審査）＋ ビジネス認証** が必要です。
（プライバシーポリシーURL・使い方のデモ動画を提出。自分/テスター役のアカウントだけなら審査前でも動作確認できます。）

## 動作確認

1. キーを登録してデプロイ
2. Meta の Webhook 設定画面で「検証して保存」→ 緑のチェックが出れば GET 検証は成功
3. テスト用アカウントから自分のインスタにDMを送る
4. 受信トレイに「【Instagram DM】…」のカードが自動で立てば成功

## メモ（公式仕様の要点・2026年確認済み）

- 過去DMの本文取得は直近20件まで（古いものは取得不可）。連携後の新規DMは全部取れる。
- DM送信は相手の最終メッセージから24時間以内（human_agentタグで7日まで）。**読む／記録は無制限**。
- 長期トークンは60日で失効 → 自動リフレッシュの仕組みは「DM送信／送信者名取得」を使う段階で追加予定。
- メッセージAPIの利用は無料。
