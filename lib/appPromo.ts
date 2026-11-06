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

export const APP_STORE_URL = "https://apps.apple.com/jp/app/komaro/id6805110615";

/** 全画面の誘導を出す場面。 */
export type AppPromoPlacement = "create" | "answer" | "calendar";

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

// ── 表示回数の記録 ─────────────────────────────────────────────────────────
//
// アカウントが無いサービスなので端末ごと（localStorage）でよい。
// プライベートウィンドウなどで読み書きが失敗することがあるため、
// 失敗したときは「出さない」側に倒す。出し損ねても誰も困らない。

const LEDGER_KEY = "komaro_app_promo";

const DAY = 24 * 60 * 60 * 1000;
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

function today() {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
}

function readLedger(): Ledger | null {
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Ledger) : {};
  } catch {
    return null;
  }
}

function writeLedger(next: Ledger) {
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(next));
  } catch {
    // 書けなくても利用には影響しない
  }
}

/** いま全画面の誘導を出してよいか。 */
export function canShowFullscreenPromo(): boolean {
  const ledger = readLedger();
  // 読めない＝記録できない。無限に出し続ける事故を避けるため出さない
  if (!ledger) return false;
  if (ledger.converted) return false;
  if (ledger.mutedUntil && Date.now() < ledger.mutedUntil) return false;
  if (ledger.day === today() && (ledger.dayCount ?? 0) >= MAX_PER_DAY) return false;
  return true;
}

export function markFullscreenPromoShown() {
  const ledger = readLedger() ?? {};
  const d = today();
  writeLedger({
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
  const ledger = readLedger() ?? {};
  const dismissals = (ledger.dismissals ?? 0) + 1;
  const days = dismissals >= DISMISSALS_BEFORE_LONG_MUTE ? LONG_MUTE_DAYS : MUTE_AFTER_DISMISS_DAYS;
  writeLedger({ ...ledger, dismissals, mutedUntil: Date.now() + days * DAY });
}

/** 「入手」「追加」が押された。以後は出さない。 */
export function markFullscreenPromoConverted() {
  writeLedger({ ...(readLedger() ?? {}), converted: true });
}

// ── 出すきっかけ ───────────────────────────────────────────────────────────
//
// 誘導を出したい場所（作成完了・回答完了・カレンダー追加）と、実際に描画する
// コンポーネント（レイアウトに1つだけ置く）を繋ぐ。ページ側は
// `requestAppPromo("answer")` を呼ぶだけでよい。

type Listener = (placement: AppPromoPlacement) => void;

const listeners = new Set<Listener>();

export function onAppPromoRequest(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 全画面の誘導を出すよう頼む。
 *
 * 出るかどうかは受け取る側が決める（端末・頻度・設定）。
 * **呼ぶ側は結果を気にしなくてよい。** 出なくても画面は何も変わらない。
 */
export function requestAppPromo(placement: AppPromoPlacement) {
  listeners.forEach((listener) => listener(placement));
}
