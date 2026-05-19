# KOMARO Codex Guide

日本語メモ:

- これは Codex 専用の作業ガイドです。
- 既存の `README.md`、`.claude/launch.json`、`.env`、アプリ本体は変更していません。
- `.env` には秘密情報が含まれる可能性があるため、中身をこのファイルにはコピーしません。

## Overview

- Project name in `package.json`: `routine`
  - 日本語: `package.json` 上の名前は `routine` です。旧 Claude Code の `routine` 起動設定はこのプロジェクトに対応すると判断しています。
- Product: KOMARO, a schedule coordination service.
  - 日本語: KOMARO は日程調整サービスです。
- Stack: Next.js, React, Prisma, PostgreSQL adapter, Tailwind CSS.
  - 日本語: Next.js（Web アプリのフレームワーク）、Prisma（データベース操作ツール）、Tailwind CSS（見た目のスタイル）を使っています。

## Common Commands

```sh
npm run dev
npm run lint
npm run build
npm run db:push
```

日本語:

- `npm run dev`: 開発サーバーを起動します。通常は `http://localhost:3000` です。
- `npm run lint`: コードの静的チェックをします。
- `npm run build`: 本番用ビルドを作ります。`prisma generate` も実行されます。
- `npm run db:push`: Prisma のスキーマをデータベースへ反映します。実行前に接続先を確認してください。

## Launch

```sh
cd /Users/naoyatsuji/Desktop/Codex/KOMARO
npm run dev
```

日本語:

- 旧 `/Users/naoyatsuji/Desktop/Claude Code/KOMORO` や `routine` ではなく、Codex 側ではこの `KOMARO` フォルダを使います。
- 既存の `.claude/launch.json` は残しています。

## Current Operations Context

- Status file: `status.json`
  - 日本語: KPI、今日の作業、次アクション、ブロッカーが入っています。
- Current KPI themes: MAU measurement, LINE sharing flow, SEO improvements.
  - 日本語: 現在の主なテーマは MAU 計測、LINE 共有導線、SEO 改善です。
- Project PM in SHIN: Jony.
  - 日本語: SHIN 体制上の担当 PM は Jony です。

## Safety Notes

- Do not overwrite user changes. This repo currently has existing uncommitted changes.
  - 日本語: 既存の未コミット変更があります。Codex は勝手に戻しません。
- Do not copy `.env` contents into docs or memory.
  - 日本語: `.env` の中身はドキュメントやメモリにコピーしません。
- Deployment and database changes require explicit approval.
  - 日本語: デプロイ（本番公開）や DB 変更は、実行前に明示的な承認が必要です。

