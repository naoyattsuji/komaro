/**
 * アプリへの誘導（自社枠）の共通部分。
 *
 * Web側はAdSenseの審査が降りていないため広告を出せない。その代わりに
 * 「iPhoneアプリ」「ホーム画面に追加」へ誘導する。**これは広告ではない**ので
 * AdSenseのポリシーは関わらないが、うっとうしければ同じことなので、
 * 全画面で出す場合の頻度はこのファイルで厳しく絞る。
 *
 * 設計は docs/ads-interstitial.md。
 */

import { DAY_MS, readJson, todayKey, writeJson } from "@/lib/taskDone";

export const APP_STORE_URL = "https://apps.apple.com/jp/app/komaro/id6805110615";

/** 全画面の誘導を出すか。未設定ならオフ。 */
export const APP_PROMO_FULLSCREEN_ENABLED =
  process.env.NEXT_PUBLIC_APP_PROMO_FULLSCREEN === "true";

/** iOS端末か。App Storeへの案内は、実際に入れられる人にだけ出す。 */
export function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOSはMacintoshを名乗るため、タッチの有無で見分ける
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** すでにホーム画面から開いている（インストール済み）か。 */
export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari の独自プロパティ
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * 端末の種類は購読する必要がない外部の値なので `useSyncExternalStore` で読む。
 * 効果の中で `setState` すると描画のあとにもう一度描画が走る（lintにも止められる）。
 */
export const subscribeNothing = () => () => {};
export const getIsIOSTarget = () => !isStandalone() && isIOS();
/** サーバー側では端末が分からない。出さない側に倒す。 */
export const getIsIOSTargetOnServer = () => false;

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// ── 全画面とカードの出し分け ──────────────────────────────────────────────
//
// **同じ案内を同時に2つ出さないため。** 完了画面にはカードの誘導（`AppPromo`）が
// すでに置いてあり、そこへ全画面が重なると「iPhoneアプリがあります」が画面に
// 2つ並ぶ（2026-11-11に実機で確認）。全画面が開いている間はカードを引っ込める。
//
// React の外に持つ軽い入れ物。`useSyncExternalStore` で読む。

let fullscreenOpen = false;
const fullscreenListeners = new Set<() => void>();

/** 全画面の誘導が開いた・閉じたことを知らせる。 */
export function setFullscreenPromoOpen(open: boolean) {
  if (fullscreenOpen === open) return;
  fullscreenOpen = open;
  fullscreenListeners.forEach((listener) => listener());
}

export function subscribeFullscreenPromo(onChange: () => void) {
  fullscreenListeners.add(onChange);
  return () => {
    fullscreenListeners.delete(onChange);
  };
}

export const getFullscreenPromoOpen = () => fullscreenOpen;
/** サーバー側では開いていない。 */
export const getFullscreenPromoOpenOnServer = () => false;

// ── 表示回数の記録 ─────────────────────────────────────────────────────────
//
// アカウントが無いサービスなので端末ごと（localStorage）でよい。
// プライベートウィンドウなどで読み書きが失敗することがあるため、
// 失敗したときは「出さない」側に倒す。出し損ねても誰も困らない。

const LEDGER_KEY = "komaro_app_promo";

/** 1日に出せる回数。 */
const MAX_PER_DAY = 1;
/** ×で閉じられたあと黙る日数。 */
const MUTE_AFTER_DISMISS_DAYS = 7;
/** 何回閉じられたら長く黙るか。 */
const DISMISSALS_BEFORE_LONG_MUTE = 3;
/** 上の回数に達したあと黙る日数。 */
const LONG_MUTE_DAYS = 30;

interface Ledger {
  /** 最後に出した日（YYYY-MM-DD） */
  day?: string;
  /** その日に出した回数 */
  dayCount?: number;
  /** ×・背景・「あとで」で閉じられた回数 */
  dismissals?: number;
  /** この時刻まで出さない（epoch ms） */
  mutedUntil?: number;
  /** 「入手」「追加」を押した。以後は二度と出さない */
  converted?: boolean;
}

/** いま全画面の誘導を出してよいか。 */
export function canShowFullscreenPromo(): boolean {
  const ledger = readJson<Ledger>(LEDGER_KEY);
  // 読めない＝記録できない。無限に出し続ける事故を避けるため出さない
  if (!ledger) return false;
  if (ledger.converted) return false;
  if (ledger.mutedUntil && Date.now() < ledger.mutedUntil) return false;
  if (ledger.day === todayKey() && (ledger.dayCount ?? 0) >= MAX_PER_DAY) return false;
  return true;
}

export function markFullscreenPromoShown() {
  const ledger = readJson<Ledger>(LEDGER_KEY) ?? {};
  const d = todayKey();
  writeJson(LEDGER_KEY, {
    ...ledger,
    day: d,
    dayCount: ledger.day === d ? (ledger.dayCount ?? 0) + 1 : 1,
  });
}

/**
 * 閉じられた。
 *
 * **自動で閉じた場合は呼ばない。** 利用者が拒んだわけではないので、
 * 1日1回の上限だけで足りる。
 */
export function markFullscreenPromoDismissed() {
  const ledger = readJson<Ledger>(LEDGER_KEY) ?? {};
  const dismissals = (ledger.dismissals ?? 0) + 1;
  const days = dismissals >= DISMISSALS_BEFORE_LONG_MUTE ? LONG_MUTE_DAYS : MUTE_AFTER_DISMISS_DAYS;
  writeJson(LEDGER_KEY, { ...ledger, dismissals, mutedUntil: Date.now() + days * DAY_MS });
}

/** 「入手」「追加」が押された。以後は出さない。 */
export function markFullscreenPromoConverted() {
  writeJson(LEDGER_KEY, { ...(readJson<Ledger>(LEDGER_KEY) ?? {}), converted: true });
}
