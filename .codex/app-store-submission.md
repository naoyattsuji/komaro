# KOMARO App Store Submission Notes

日本語メモ:

- このファイルはApp Store Connect入力用の下書きです。
- 実際の提出前に、App Store Connect上の表示とAppleの最新入力項目を確認してください。
- 秘密情報やApple IDの認証情報はここに書かないでください。

## App Basics

- App name: `KOMARO`
  - 日本語: ストア表示名です。
- Bundle ID: `app.komaro`
  - 日本語: Xcode側のBundle Identifierです。
- SKU suggestion: `komaro-ios`
  - 日本語: App Store Connectで求められる管理用SKU案です。外部公開はされません。
- Primary language: Japanese
  - 日本語: 主な対象言語は日本語です。
- Category suggestion: Productivity
  - 日本語: 日程調整ツールなので「仕事効率化」が第一候補です。

## Product Page Draft

### Subtitle

コマで見る日程調整

### Promotional Text

登録不要。URLを共有するだけで、メンバーの空き時間をコマの色でひと目確認できます。

### Description

KOMAROは、複数人の日程調整をシンプルに進めるためのスケジュール調整アプリです。

イベントを作成してURLを共有すると、参加者は空いているコマをタップするだけで回答できます。集計画面では参加できる人数がコマの色で表示されるため、全員が集まりやすい時間をすばやく見つけられます。

主な機能:

- 登録不要でイベント作成
- 参加者向けURLをLINEやチャットで共有
- コマの色で空き時間を集計
- セルをタップして参加可能メンバーを確認
- 回答の修正、イベント設定の編集
- カレンダーへの予定追加
- アプリ内の最近のイベント履歴

会議、飲み会、面談、イベント運営など、複数人の予定をまとめたい場面で使えます。

### Keywords

日程調整,予定調整,スケジュール,カレンダー,会議,イベント,出欠,LINE共有

### Support URL

https://komaro.app/help

### Privacy Policy URL

https://komaro.app/privacy

## Review Notes Draft

KOMARO is a schedule coordination app for Japanese users. Users can create an event, share the participant URL, collect availability responses, and view aggregated availability in a grid. The iOS app also keeps a recent-event history on the device so users can quickly return to events they created, joined, or viewed.

No login is required. A sample flow for review:

1. Tap `イベントを作成`.
2. Create a test event with any title.
3. Open the generated participant URL.
4. Enter a participant name and select available cells.
5. View the aggregated result page.

日本語:

- 審査担当者向け説明です。
- ログイン不要で動作します。
- WebViewのみではなく、アプリ内では端末保存の最近のイベント履歴を提供します。

## App Privacy Draft

日本語メモ:

- App Store Connectの「App Privacy」入力用の下書きです。
- 実際の選択肢名はApp Store Connect画面に合わせてください。

Recommended conservative disclosures:

- Contact Info
  - Email Address: collected only when users submit the contact form.
  - 日本語: 問い合わせフォームでメールアドレスを入力した場合のみ扱います。
- User Content
  - Other User Content: event titles, event descriptions, participant names, availability answers, and comments.
  - 日本語: イベント名、説明、参加者名、回答、コメントを扱います。
- Identifiers
  - User ID: not used because there is no account system.
  - Device ID: Google Analytics may process device or instance identifiers depending on platform behavior.
  - 日本語: アカウントIDはありません。解析では端末・インスタンス由来の識別子が扱われる可能性があります。
- Usage Data
  - Product Interaction: used for analytics and service improvement.
  - 日本語: 利用状況の分析と改善に使います。
- Diagnostics
  - Crash Data / Performance Data: only if collected by Apple, Vercel, Google Analytics, or hosting/runtime tooling.
  - 日本語: 実際に有効な収集設定に合わせて申告してください。

Tracking:

- Do not mark as tracking if data is not used to track users across apps and websites owned by other companies for advertising or data broker purposes.
- 日本語: 広告目的や他社アプリ・Webサイト横断の追跡に使っていない前提なら、Apple定義の「トラッキング」にはしない方針です。

## Pre-Submission Checklist

- [x] Bundle ID set to `app.komaro`.
- [x] App display name set to `KOMARO`.
- [x] Release archive builds successfully.
- [x] Privacy policy reflects Google Analytics usage.
- [x] Simulator build launches successfully.
- [x] Product page draft prepared.
- [x] App Privacy draft prepared.
- [ ] Upload archive to App Store Connect.
- [ ] Create App Store Connect app record.
- [ ] Add screenshots.
- [ ] Enter product page metadata.
- [ ] Complete age rating.
- [ ] Complete App Privacy.
- [ ] Select uploaded build.
- [ ] Submit for review.

## Current Upload Blocker

`xcodebuild -exportArchive` failed because Xcode could not find an App Store Connect provider for the signed-in account.

日本語:

- Archive作成は成功しています。
- CLIアップロードは `No Accounts with App Store Connect Access` で停止しました。
- Xcodeの `Settings > Accounts` でApp Store Connect権限のあるApple IDにログインし、正しいTeam/Providerを選択する必要があります。
- その後、Xcode OrganizerからArchiveをアップロードするか、App Store Connect APIキーを用意してCLIアップロードを再実行します。
