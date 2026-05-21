# KOMARO Native App Notes

日本語メモ:

- KOMARO の iOS / Android アプリ版は Capacitor で作成します。
- 既存の Next.js アプリを作り直さず、アプリ内 WebView で `https://komaro.app` を読み込む構成です。
- Web 版の本番反映が、そのままアプリ版にも反映されます。
- App Store / Google Play 申請前には、アプリアイコン、起動画面、ストア文言、審査向けのネイティブらしい機能を確認します。

## Current Setup

- App name: `KOMARO`
  - 日本語: アプリに表示する名前です。
- App ID / Bundle ID: `app.komaro`
  - 日本語: iOS / Android のアプリ識別子です。ストア申請前に確定してください。
- Capacitor config: `capacitor.config.ts`
  - 日本語: Capacitor の設定ファイルです。
- iOS project: `ios/`
  - 日本語: Xcode で開く iOS プロジェクトです。
- Android project: `android/`
  - 日本語: Android Studio で開く Android プロジェクトです。

## Commands

```sh
npm run cap:sync
npm run cap:open:ios
npm run cap:open:android
```

日本語:

- `npm run cap:sync`: Capacitor 設定と Web アセットを iOS / Android 側へ同期します。
- `npm run cap:open:ios`: Xcode で iOS プロジェクトを開きます。
- `npm run cap:open:android`: Android Studio で Android プロジェクトを開きます。

## Next Native Features

日本語:

- アプリアイコンとスプラッシュ画面を KOMARO ブランドに合わせる。
- LINE共有 / リンクコピーをアプリ内でも自然に使えるか確認する。
- 作成済み / 参加済みイベント履歴を端末側に保存する。
- 必要ならリマインダー通知を追加する。
- iOS / Android の戻る操作、外部リンク、共有先遷移を実機で確認する。
