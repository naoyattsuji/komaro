# App Review への返信ドラフト（ガイドライン 2.1 対応）

Submission ID: `d3cc631b-67f5-455f-825c-79bff9d93b63`
送り先: App Store Connect → App Review ページ →「返信」

**送信前に埋めるもの**
- 項目1: 実機で撮影した画面収録を添付する
- 項目2: 実際に使った iPhone の機種名と iOS バージョン

---

Thank you for the feedback. Here is all of the requested information.

**1. Screen recording**

Attached. The recording was captured on a physical iPhone running the latest iOS, using a TestFlight build of the submitted binary. It starts with launching the app and shows the full core flow: creating an event, sharing screen, answering by tapping availability cells, submitting, and viewing the aggregated result grid, then returning to the home screen where the locally stored recent-event history is shown.

The app has none of the flows listed in your note: there is no account registration, login, or account deletion (the app has no user accounts), no paid content, purchases, or subscriptions, and no prompts requesting access to location, contacts, camera, photos, notifications, or App Tracking Transparency.

Regarding user-generated content: event titles, participant names, and comments are visible only to people who have the event URL, which is an unguessable random ID and is not listed or searchable. Any participant can edit or delete their own answer at any time from the result screen, and the event organizer can edit or delete the event and any answer. Events are automatically deleted 120 days after their last update.

**2. Devices and operating systems tested**

<!-- 例: iPhone 15 Pro (iOS 26.3), iPad Pro 13-inch (M4) (iPadOS 26.3) -->
（ここに実機の機種と OS を記入）

**3. App functions and target audience**

KOMARO is a free group-availability polling (schedule coordination) app for Japanese users. Coordinating a meeting time among several people is normally done over chat and takes many back-and-forth messages. With KOMARO, an organizer creates an event as a grid of candidate dates by time slots, shares one URL, and each participant taps the cells they are available for. The result grid colors each cell by how many people are available, so the best time is visible at a glance.

Target audience: general users in Japan scheduling meetings, dinners, interviews, or club events. No account and no specialized knowledge is required.

Core features: create an event without registration (three grid formats), share a participant URL via LINE or any chat app, answer by tapping cells, view the aggregated grid, tap a cell to see who is available, edit or delete answers, optionally protect event settings with a password, add a confirmed date to Google / Yahoo / iCloud calendar, and a recent-event history stored locally on the device that is shown on the app home screen only.

**4. How to set up and access the main features**

No login, no demo account, and no sample files are needed. Everything is reachable from the first screen.

1. Launch the app.
2. Tap "作成" (Create) in the top-right of the header.
3. Enter any event title, tap "次へ: 軸の設定" (Next), then "イベントを作成する" (Create event).
4. On the completion screen, tap "イベントを確認する" (View event) to open the aggregated grid.
5. Tap "回答する" (Answer), type any name, tap several cells, then tap "この内容で送信する" (Submit).
6. The grid now counts and colors the cells you selected.
7. Return to the app home screen to see the event under "最近のイベント" (Recent events), stored on the device.

**5. External services used**

- Vercel — web application hosting
- Neon — PostgreSQL database storing events, participant names, availability answers, and comments
- Google Analytics 4 — anonymous usage analytics only. No advertising and no cross-app tracking.
- Google Gemini API (gemini-2.0-flash) — optional convenience only. Parses a spoken sentence or a calendar screenshot into candidate dates when the organizer chooses voice or image input while creating an event. The app is fully usable without it; dates can always be entered manually.
- Tesseract.js — on-device OCR used with the image input feature. Runs locally.

There is no authentication provider, no payment processor, no advertising SDK, and no in-app purchase.

**6. Regional differences**

There are none. The app behaves identically in all regions. The interface is Japanese only, all features are available to every user regardless of region, no content is region-restricted, and no feature is enabled or disabled by region.

**7. Regulated industry / protected third-party material**

Not applicable. KOMARO does not operate in a regulated industry and does not include third-party protected material. All text, icons, and illustrations are original works owned by the developer.

We have also added items 3 through 7 to the App Review Information notes field for future submissions. Thank you for your time.
