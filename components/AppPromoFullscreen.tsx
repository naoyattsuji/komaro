"use client";

import { Capacitor } from "@capacitor/core";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { trackEvent } from "@/lib/ga";
import {
  APP_PROMO_FULLSCREEN_ENABLED,
  APP_STORE_URL,
  type AppPromoPlacement,
  canShowFullscreenPromo,
  getIsIOSTarget,
  getIsIOSTargetOnServer,
  type InstallPrompt,
  isStandalone,
  markFullscreenPromoConverted,
  markFullscreenPromoDismissed,
  markFullscreenPromoShown,
  onAppPromoRequest,
  subscribeNothing,
} from "@/lib/appPromo";

/** 指が離れてからこれだけ待ってから出す。着地点に重ねないため。 */
const SHOW_DELAY_MS = 800;
/** 何もしなければこれで自動的に閉じる。 */
const AUTO_CLOSE_MS = 5000;

type Kind = "ios" | "pwa";
type CloseReason = "close" | "backdrop" | "later" | "auto" | "convert";

const COPY: Record<Kind, { title: string; body: string; action: string }> = {
  ios: {
    title: "iPhoneアプリがあります",
    body: "見たイベントがすぐ開けます",
    action: "入手する",
  },
  pwa: {
    title: "アプリとして追加できます",
    body: "次から1タップで開けます",
    action: "追加する",
  },
};

/**
 * 全画面のアプリ誘導。レイアウトに1つだけ置き、`requestAppPromo()` で呼び出す。
 *
 * **広告ではない。** Web側はAdSenseの審査が降りておらず全画面広告を出せないため、
 * その場所でアプリへの誘導をする（docs/ads-interstitial.md）。自社のUIなので、
 * AdMobの全画面広告と違って**×も自動クローズも自分で作れる**。
 *
 * 出さない場合:
 * - ネイティブアプリの中（アプリの中でアプリを勧めても仕方がない）
 * - すでにホーム画面から開いている
 * - 設定がオフ
 * - 頻度の上限に達している（lib/appPromo.ts）
 * - Androidなどで「ホーム画面に追加」ができない端末
 */
export function AppPromoFullscreen() {
  const [placement, setPlacement] = useState<AppPromoPlacement | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  const ios = useSyncExternalStore(subscribeNothing, getIsIOSTarget, getIsIOSTargetOnServer);
  const isNativeApp = useSyncExternalStore(
    subscribeNothing,
    () => Capacitor.isNativePlatform(),
    // サーバー側は「ネイティブ扱い」にして描画しない
    () => true
  );

  // 出すまでの待ちと、自動で閉じるまでの待ち
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const kind: Kind | null = ios ? "ios" : installPrompt ? "pwa" : null;
  const open = placement !== null;

  // Androidなどで「ホーム画面に追加」が可能になったときに届く
  useEffect(() => {
    if (isNativeApp || ios) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isNativeApp, ios]);

  const close = useCallback(
    (reason: CloseReason) => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      autoTimer.current = null;
      setPlacement((current) => {
        if (current === null) return null;
        trackEvent("app_promo_fullscreen_result", {
          placement: current,
          kind: kind ?? "unknown",
          result: reason,
        });
        // 自動で閉じたのは「拒まれた」ではないので、黙る期間を延ばさない
        if (reason !== "auto" && reason !== "convert") markFullscreenPromoDismissed();
        return null;
      });
    },
    [kind]
  );

  // 呼び出しを受ける。出せない条件はここで全部はじく
  useEffect(() => {
    if (!APP_PROMO_FULLSCREEN_ENABLED || isNativeApp) return;

    return onAppPromoRequest((next) => {
      if (kind === null) return;
      if (isStandalone()) return;
      if (!canShowFullscreenPromo()) return;
      if (showTimer.current) clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => {
        markFullscreenPromoShown();
        trackEvent("app_promo_fullscreen_shown", { placement: next, kind });
        setPlacement(next);
      }, SHOW_DELAY_MS);
    });
  }, [isNativeApp, kind]);

  useEffect(() => {
    return () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    };
  }, []);

  // 開いている間だけ: 自動で閉じる・Escで閉じる・背面をスクロールさせない
  useEffect(() => {
    if (!open) return;

    autoTimer.current = setTimeout(() => close("auto"), AUTO_CLOSE_MS);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("close");
    };
    window.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      autoTimer.current = null;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  if (!open || kind === null) return null;

  const copy = COPY[kind];

  const handleConvert = async () => {
    trackEvent("app_promo_fullscreen_click", { placement, kind });
    markFullscreenPromoConverted();

    if (kind === "pwa" && installPrompt) {
      close("convert");
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      trackEvent("app_promo_result", { placement, outcome });
      setInstallPrompt(null);
      return;
    }
    // iOSはリンクなので、閉じるのは遷移の邪魔にならないよう後回しにする
    close("convert");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-promo-title"
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={() => close("backdrop")}
        className="absolute inset-0 h-full w-full cursor-default bg-gray-900/50"
      />

      <div className="anim-hero-scale relative w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl">
        <button
          type="button"
          onClick={() => close("close")}
          aria-label="閉じる"
          className="absolute right-2 top-2 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <Image
          src="/icon-192.png"
          alt=""
          width={64}
          height={64}
          className="mx-auto h-16 w-16 rounded-[14px]"
        />

        <p id="app-promo-title" className="mt-4 text-base font-bold text-gray-900">
          {copy.title}
        </p>
        <p className="mt-1 text-sm text-gray-500">{copy.body}</p>

        {kind === "ios" ? (
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleConvert}
            className="mt-5 block w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            {copy.action}
          </a>
        ) : (
          <button
            type="button"
            onClick={handleConvert}
            className="mt-5 block w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            {copy.action}
          </button>
        )}

        <button
          type="button"
          onClick={() => close("later")}
          className="mt-3 text-xs text-gray-400 transition-colors hover:text-gray-600"
        >
          あとで
        </button>
      </div>
    </div>
  );
}
