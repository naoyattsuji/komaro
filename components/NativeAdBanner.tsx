"use client";

import { Capacitor } from "@capacitor/core";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ADMOB_BANNER_ID, ADMOB_ENABLED, shouldShowAppBanner } from "@/lib/ads";
import { ensureAdMobInitialized } from "@/lib/admob";
import { adNonPersonalized } from "@/lib/adTracking";

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
 * - **ATTで許可された人だけ個人向け広告**（`lib/adTracking.ts`）。それ以外は非パーソナライズ。
 * - バナーの高さぶんだけ `body` に余白を足し、コンテンツが隠れないようにする。
 */

/**
 * バナーの上に空ける余白。
 *
 * 画面末尾の全幅ボタン（「イベントを作成する」など）がバナーに接していると、
 * 押し損ねた指がそのまま広告に落ちる。誤タップは無効クリックとして計上され、
 * アカウント停止に直結するため、バナーの高さに必ずこれだけ足す。
 */
const TAP_GAP_PX = 16;

/**
 * 高さが分かるまで使う仮の値。
 *
 * iPhoneのアダプティブバナーは50pt前後。実測が来たら上書きするので、
 * 多めに取っておく（足りないと本文がバナーの下に隠れる）。
 */
const FALLBACK_BANNER_HEIGHT = 60;

/** バナーの高さぶん（＋誤タップ防止の余白）を本文の下に空ける。0 で元に戻す。 */
function applyPadding(height: number) {
  document.body.style.paddingBottom = height > 0 ? `${height + TAP_GAP_PX}px` : "";
}

export function NativeAdBanner() {
  const pathname = usePathname();
  const initializedRef = useRef(false);
  const shownRef = useRef(false);
  /** 直近に実測したバナーの高さ。2回目以降は出した瞬間に余白を当てるために持っておく。 */
  const heightRef = useRef(0);

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
        await ensureAdMobInitialized();
        // ATT の画面を待つ間に画面が変わったら、新しい方の処理に任せる（リスナーの二重登録を防ぐ）
        if (cancelled) return;
        // バナーの実寸が決まったら、その高さぶん本文の下に余白を作る
        await AdMob.addListener(BannerAdPluginEvents.SizeChanged, ({ height }) => {
          if (height > 0) heightRef.current = height;
          applyPadding(height);
        });
        initializedRef.current = true;
      }
      if (cancelled) return;

      const wanted = shouldShowAppBanner(pathname);

      if (wanted && !shownRef.current) {
        // **実寸を待たずにここで余白を当てる。** SizeChanged を待つと、その間は
        // 画面末尾のボタンがバナーに隠れる。実測が来たら上のリスナーが直す
        applyPadding(heightRef.current || FALLBACK_BANNER_HEIGHT);
        await AdMob.showBanner({
          adId: ADMOB_BANNER_ID,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          npa: await adNonPersonalized(),
        });
        shownRef.current = true;
      } else if (!wanted && shownRef.current) {
        await AdMob.hideBanner();
        applyPadding(0);
        shownRef.current = false;
      }
    })().catch(() => {
      // 広告が出せなくてもアプリの利用は妨げない
      applyPadding(0);
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
