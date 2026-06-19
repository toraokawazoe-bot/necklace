# セキュリティ設定手順（運用者ログイン + Firestore ルール厳格化）

これまで Firestore は「誰でも全データを読み書き・削除できる」状態でした
（`firestore.rules` が `allow read, write: if true`）。本手順で **運用者だけが
アクセスできる**状態に締めます。

## 仕組み（なぜこの構成か）

- **ブラウザ（アプリ本体）**：Firebase Auth でログインした運用者だけが Firestore に
  アクセスできるようルールを `request.auth != null` に変更。
- **サーバー（Instagram の webhook / 返信送信 API）**：Meta から来る webhook は
  Firebase 認証を持たない。そのため **Admin SDK（サービスアカウント）** を使い、
  ルールをバイパスして書き込む。これでルールを締めても DM 取り込みは動き続ける。

> コードは実装済み。あとは下記の設定と、**安全な順序での切り替え**だけ。

---

## やること（この順番で）

### 1. Firebase Authentication を有効化
1. Firebase Console → Authentication → 始める
2. ログイン方法で **メール / パスワード** を有効化
3. Users → ユーザーを追加 で **運用者のアカウント（自分のメール＋パスワード）** を作成
   - ここで作ったアカウントだけがログインできる（アプリにサインアップ画面は無い）
4. **⚠ セルフサインアップ対策**：メール/パスワードが有効だと、公開 API キー経由で
   第三者が勝手にアカウントを作れてしまう（＝`request.auth != null` だけのルールを
   通過できる）。次のどちらかで必ず塞ぐこと：
   - Google Cloud Console → Identity Platform でセルフ登録（サインアップ）を無効化する、**または**
   - 手順6でルールと送信APIを **運用者の UID 固定** にする（推奨。下記）。
   - 運用者の UID は Authentication → Users で確認できる。

### 2. サービスアカウント鍵を発行
1. Firebase Console → プロジェクトの設定 → サービス アカウント
2. 「新しい秘密鍵を生成」→ ダウンロードされる JSON を控える

### 3. 環境変数を登録（Vercel の Settings → Environment Variables と、ローカルの `.env.local`）
| 変数名 | 値 |
|--------|-----|
| `FIREBASE_SERVICE_ACCOUNT` | 手順2の JSON を**そのまま貼る**（1行 JSON でも base64 でも可） |
| `OWNER_UID` | 運用者の UID（Authentication → Users で確認）。送信 API を本人限定にする。推奨 |
| `NEXT_PUBLIC_REQUIRE_AUTH` | まだ空のままにしておく（後で `1` にする） |

> `FIREBASE_SERVICE_ACCOUNT` は機密。GitHub などに絶対コミットしない（`.env.local` は git 管理外）。

> **⚠ webhook を本番接続する前に `FIREBASE_SERVICE_ACCOUNT` を入れること。** 鍵が無い間に届いた
> DM は保存できず、webhook は 503 を返して Meta に再送を促す（鍵を入れれば再送分は救える）。
> 鍵設定前から長時間接続したままだと、再送が尽きた DM は取りこぼす。

### 4. デプロイして「サーバーが Admin SDK で書ける」ことを確認
- `FIREBASE_SERVICE_ACCOUNT` を入れた状態で本番デプロイ。
- テスト用アカウントから自分のインスタに DM → 受信トレイにカードが立てば、
  Admin SDK 経由の書き込みが効いている（＝ルールを締めても webhook が動く準備OK）。

### 5. ログインを有効化
- `NEXT_PUBLIC_REQUIRE_AUTH=1` を設定して再デプロイ。
- アプリを開くとログイン画面が出る。手順1で作ったアカウントでログインできることを確認。
- DM 返信もログイン状態で送れることを確認。

### 6. 最後に Firestore ルールを厳格化（これで全開放が閉じる）
```
firebase deploy --only firestore:rules
```
- `firestore.rules` は既に `request.auth != null` に更新済み。これを**デプロイして初めて**
  本番のルールが締まる。手順5までで「ログイン済みブラウザ」と「Admin SDK サーバー」の
  両方が動くことを確認してから実行すること。
- **推奨：運用者1人に絞る。** セルフサインアップを無効化していない場合、`request.auth != null`
  だけでは第三者の自前アカウントも通る。`firestore.rules` の該当行を UID 固定に変更すること
  （ファイル内コメント参照）。UID は Authentication → Users で確認。
  送信 API 側も `OWNER_UID` を設定しておけば本人以外を 403 で弾く。

> **⚠ 送信 API の認可は `NEXT_PUBLIC_REQUIRE_AUTH` に連動する。** これを空に戻すと送信 API も
> 無認証に戻り、`INSTAGRAM_ACCESS_TOKEN` 設定済みなら第三者が IGSID を知るだけでショップ名義の
> DM を送れてしまう。本番で返信機能を使うなら `NEXT_PUBLIC_REQUIRE_AUTH=1` を維持し、確認用途でも
> 安易に空へ戻さないこと。

---

## ロールバック / 注意
- 締めた後にアプリが真っ白／読み込めない場合：ログインできているか、`FIREBASE_SERVICE_ACCOUNT`
  が正しいか、ルールが意図通りかを確認。応急処置としてルールを一時的に元へ戻すことも可能
  （ただし全開放に戻るので最小限に）。
- `NEXT_PUBLIC_REQUIRE_AUTH` を空に戻せば、ログイン要求だけは即座に無効化できる
  （ルールはデプロイ済みのものが効いたままなので、確認用途に）。
