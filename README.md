# オーダー管理アプリ

ハンドメイドネックレス・ブレスレットのオーダー管理 Web アプリです。
インスタ DM からの受注を「受信トレイ」で漏れなく記録し、
ステータス管理で発送までしっかり追跡できます。

## 主な機能

- DM が来たらワンタップで受信トレイに追加
- ネックレス / ブレスレットの種別、長さ、デザイン、支払方法、ステータス、メモを管理
- ステータス別フィルター（受信 / 問い合わせ / 制作 / 支払い / 発送 / 完了 / 失注）
- 受注日は自動記録
- スマホでホーム画面に追加可能（PWA）
- ダークモード対応

## 技術スタック

- Next.js 14（App Router）
- React 18
- TypeScript
- CSS Modules
- データ保存：localStorage（将来 Google スプレッドシート連携予定）

## 開発手順

```bash
npm install
npm run dev
```

http://localhost:3000 で開く。

## ビルド

```bash
npm run build
npm start
```

## デプロイ

Vercel に GitHub 連携でデプロイ推奨。
