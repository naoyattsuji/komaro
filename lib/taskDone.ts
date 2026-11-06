/**
 * 「作業が完全に終わった瞬間」を知らせる仕組み。
 *
 * 全画面で何かを出してよいのはこの瞬間だけ（docs/ads-interstitial.md）。
 * 受け取る側が2つある。
 *
 * - Web  … `components/AppPromoFullscreen.tsx`（アプリへの誘導）
 * - アプリ … `components/NativeInterstitial.tsx`（AdMobの全画面広告）
 *
 * 呼ぶ側は結果を気にしなくてよい。**出なくても画面は何も変わらない。**
 */

/** 作業が終わった場面。 */
export type TaskDonePlacement = "create" | "answer" | "calendar";

type Listener = (placement: TaskDonePlacement) => void;

const listeners = new Set<Listener>();

export function onTaskDone(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyTaskDone(placement: TaskDonePlacement) {
  listeners.forEach((listener) => listener(placement));
}

// ── 表示回数の記録（共通） ─────────────────────────────────────────────────
//
// Webの誘導とアプリの広告で別々に数える。アカウントが無いサービスなので
// 端末ごと（localStorage）でよい。読み書きが失敗したときは「出さない」側に倒す。
// 出し損ねても誰も困らないが、無限に出し続ける事故は困る。

export const DAY_MS = 24 * 60 * 60 * 1000;

export function todayKey() {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {} as T;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : ({} as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 書けなくても利用には影響しない
  }
}
