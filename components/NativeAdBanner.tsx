"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ADMOB_BANNER_ID, ADMOB_ENABLED, shouldShowAppBanner } from "@/lib/ads";

/**
 * アプリ内のAdMobバナー。
 *
 * ネイティブアプリでだけ動く。Web側のAdSenseとは完全に別系統で、
 * `AdSlot` はアプリ内では描画しないため、両方が同時に出ることはない。
 *
 * 設計の要点:
 * - **画面ごとに出し分ける。** AdMobのバナーは放っておくと全画面に居座る追従バナーに
 *   なるが、docs/ads.md では追従バナーも回答画面の広告も禁じている。`shouldShowAppBanner`
 *   で許可した画面だけ表示し、回答・作成フォーム・規約では隠す。
 * - **非パーソナライズ広告のみ**（`npa: true`）。端末をまたぐ広告トラッキングをしないため、
 *   iOSのATT許可ダイアログが不要になり、App Privacyの「トラッキング」申告も立てずに済む。
 *   `requestTrackingAuthorization()` は意図的に呼んでいない。
 * - バナーの高さぶんだけ `body` に余白を足し、コンテンツが隠れないようにする。
 */
export function NativeAdBanner() {
  const pathname = usePathname();
  const initializedRef = useRef(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !ADMOB_ENABLED || !ADMOB_BANNER_ID) return;

    let cancelled = false;

    (async () => {
      // Web側のバンドルに含めたくないため、ネイティブと分かってから読み込む
      const { AdMob, BannerAdPluginEvents, BannerAdPosition, BannerAdSize } = await import(
        "@capacitor-community/admob"
      );
      if (cancelled) return;

      if (!initializedRef.current) {
        await AdMob.initialize({ initializeForTesting: false });
        // バナーの実寸が決まったら、その高さぶん本文の下に余白を作る
        await AdMob.addListener(BannerAdPluginEvents.SizeChanged, ({ height }) => {
          document.body.style.paddingBottom = height > 0 ? `${height}px` : "";
        });
        initializedRef.current = true;
      }
      if (cancelled) return;

      const wanted = shouldShowAppBanner(pathname);

      if (wanted && !shownRef.current) {
        await AdMob.showBanner({
          adId: ADMOB_BANNER_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          // 非パーソナライズ広告のみ。ATTとApp Privacyの申告を増やさないため
          npa: true,
        });
        shownRef.current = true;
      } else if (!wanted && shownRef.current) {
        await AdMob.hideBanner();
        document.body.style.paddingBottom = "";
        shownRef.current = false;
      }
    })().catch(() => {
      // 広告が出せなくてもアプリの利用は妨げない
      document.body.style.paddingBottom = "";
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
