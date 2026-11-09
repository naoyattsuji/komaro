"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useRef } from "react";
import { ADMOB_INTERSTITIAL_ID, isInterstitialEnabledFor } from "@/lib/ads";
import { ensureAdMobInitialized } from "@/lib/admob";
import { adNonPersonalized } from "@/lib/adTracking";
import { trackEvent } from "@/lib/ga";
import { onTaskDone, readJson, todayKey, writeJson } from "@/lib/taskDone";

const LEDGER_KEY = "komaro_admob_interstitial";

/** 前の全画面広告からこれだけ空ける。「閉じた直後にもう1本」はポリシー違反。 */
const MIN_GAP_MS = 3 * 60 * 1000;
/** 1日に出せる回数。 */
const MAX_PER_DAY = 2;
/** アプリを開いてからこれだけは出さない。起動時の表示はポリシー違反。 */
const APP_START_GRACE_MS = 10 * 1000;
/** 指が離れてからこれだけ待ってから出す。着地点に重ねないため。 */
const SHOW_DELAY_MS = 1200;

interface Ledger {
  day?: string;
  dayCount?: number;
  lastAt?: number;
}

const appStartedAt = Date.now();

function skipReason(): string | null {
  const ledger = readJson<Ledger>(LEDGER_KEY);
  // 読めない＝記録できない。無限に出し続ける事故を避けるため出さない
  if (!ledger) return "no_storage";
  if (Date.now() - appStartedAt < APP_START_GRACE_MS) return "app_just_started";
  if (ledger.lastAt && Date.now() - ledger.lastAt < MIN_GAP_MS) return "too_soon";
  if (ledger.day === todayKey() && (ledger.dayCount ?? 0) >= MAX_PER_DAY) return "daily_cap";
  return null;
}

function markShown() {
  const ledger = readJson<Ledger>(LEDGER_KEY) ?? {};
  const d = todayKey();
  writeJson(LEDGER_KEY, {
    day: d,
    dayCount: ledger.day === d ? (ledger.dayCount ?? 0) + 1 : 1,
    lastAt: Date.now(),
  });
}

/**
 * アプリ内の全画面広告（AdMob インタースティシャル）。
 *
 * レイアウトに1つだけ置く。`notifyTaskDone()` が呼ばれた瞬間のうち、
 * **作業が完全に終わった場面**でだけ出す（docs/ads-interstitial.md）。
 *
 * 出さない場合:
 * - ネイティブアプリの外（Webは `AppPromoFullscreen` が受け持つ）
 * - 設定がオフ、ユニットID未設定
 * - 広告がまだ読み込めていない … **待たない。** 広告のために利用者を待たせない
 * - 頻度の上限（3分に1回・1日2回・起動10秒以内は出さない）
 *
 * 読み込みは起動後と、閉じられた直後に仕込む。失敗しても次の起動まで再試行しない
 * （失敗を繰り返して通信を食わないため）。
 */
export function NativeInterstitial() {
  /** 読み込み済みで、いま出せるか。 */
  const readyRef = useRef(false);
  /** 読み込みを一度試したか。失敗しても繰り返さない。 */
  const triedRef = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || ADMOB_INTERSTITIAL_ID === "") return;

    let cancelled = false;
    let removeListeners: Array<() => void> = [];

    const setup = async () => {
      // Web側のバンドルに含めたくないため、ネイティブと分かってから読み込む
      const { AdMob, InterstitialAdPluginEvents } = await import("@capacitor-community/admob");
      if (cancelled) return;

      const prepare = async () => {
        if (triedRef.current && !readyRef.current) return;
        triedRef.current = true;
        try {
          // **バナーが無効でもここで初期化される。** 以前はバナー側だけが
          // 初期化していたため、全画面広告だけをオンにすると読み込めなかった
          await ensureAdMobInitialized();
          await AdMob.prepareInterstitial({
            adId: ADMOB_INTERSTITIAL_ID,
            npa: await adNonPersonalized(),
          });
        } catch {
          readyRef.current = false;
        }
      };

      const loaded = await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
        readyRef.current = true;
      });
      const failed = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
        readyRef.current = false;
      });
      const dismissed = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        trackEvent("interstitial_dismissed", {});
        readyRef.current = false;
        // 次の1本を仕込む。出せるのは最短でも3分後なので急がない
        triedRef.current = false;
        void prepare();
      });
      removeListeners = [
        () => void loaded.remove(),
        () => void failed.remove(),
        () => void dismissed.remove(),
      ];

      // 起動直後は出せないので、仕込むのもその後でよい
      setTimeout(() => {
        if (!cancelled) void prepare();
      }, APP_START_GRACE_MS);
    };

    void setup().catch(() => {
      // 広告が出せなくてもアプリの利用は妨げない
    });

    const unsubscribe = onTaskDone((placement) => {
      if (!isInterstitialEnabledFor(placement)) return;

      if (!readyRef.current) {
        trackEvent("interstitial_skipped", { placement, reason: "not_loaded" });
        return;
      }
      const reason = skipReason();
      if (reason) {
        trackEvent("interstitial_skipped", { placement, reason });
        return;
      }

      if (showTimer.current) clearTimeout(showTimer.current);
      showTimer.current = setTimeout(async () => {
        try {
          const { AdMob } = await import("@capacitor-community/admob");
          markShown();
          trackEvent("interstitial_shown", { placement });
          await AdMob.showInterstitial();
        } catch {
          trackEvent("interstitial_skipped", { placement, reason: "failed_to_show" });
        }
      }, SHOW_DELAY_MS);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (showTimer.current) clearTimeout(showTimer.current);
      removeListeners.forEach((remove) => remove());
    };
  }, []);

  return null;
}
