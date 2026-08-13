"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ADS_PERSONALIZED,
  AD_CLIENT,
  AD_SLOTS,
  isAdPlacementConfigured,
  type AdPlacement,
} from "@/lib/ads";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adsbygoogle?: any[] & { requestNonPersonalizedAds?: number };
  }
}

type FillState = "pending" | "filled" | "unfilled";

/** 広告が返ってこないまま枠を確保し続ける時間の上限（広告ブロッカー対策も兼ねる） */
const FILL_TIMEOUT_MS = 4000;

// ネイティブ判定は購読不要の外部値。サーバー側は「ネイティブ扱い」にして描画しない。
const subscribeNothing = () => () => {};
const getIsNativeApp = () => Capacitor.isNativePlatform();
const getIsNativeAppOnServer = () => true;

/**
 * AdSenseの広告枠。
 *
 * - 未設定・ネイティブアプリ内では何も描画しない。
 * - 広告が配信されなかった場合（unfilled）は枠ごと消して、空白が残らないようにする。
 * - 「スポンサー」ラベルは広告が実際に表示されたときだけ出す。
 */
export function AdSlot({
  placement,
  className = "",
  variant = "inline",
}: {
  placement: AdPlacement;
  className?: string;
  /**
   * inline: 本文の流れの中にそのまま置く。
   * section: 完了画面など下に余白が余る画面向け。区切り線と薄い背景で
   *          「ここから先はアプリの中身ではない」と分かる帯にする。
   */
  variant?: "inline" | "section";
}) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const [fill, setFill] = useState<FillState>("pending");

  const isNativeApp = useSyncExternalStore(
    subscribeNothing,
    getIsNativeApp,
    getIsNativeAppOnServer
  );

  const configured = isAdPlacementConfigured(placement);
  const slotId = AD_SLOTS[placement];
  const shouldRender = configured && !isNativeApp;

  useEffect(() => {
    if (!shouldRender || pushedRef.current) return;
    const ins = insRef.current;
    if (!ins) return;

    // 配信結果はdata-ad-status属性に入るため、埋まったかどうかを監視する
    const observer = new MutationObserver(() => {
      const status = ins.getAttribute("data-ad-status");
      if (status === "filled" || status === "unfilled") {
        setFill(status);
        observer.disconnect();
      }
    });
    observer.observe(ins, { attributes: true, attributeFilter: ["data-ad-status"] });

    // 広告ブロッカーなどでスクリプトが動かない場合、確保した高さが残り続けないようにする
    const timer = setTimeout(() => {
      setFill((current) => (current === "pending" ? "unfilled" : current));
    }, FILL_TIMEOUT_MS);

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      if (!ADS_PERSONALIZED) {
        window.adsbygoogle.requestNonPersonalizedAds = 1;
      }
      window.adsbygoogle.push({});
      pushedRef.current = true;
    } catch {
      // 読み込めなかった場合はタイムアウト側で枠を畳む
    }

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [shouldRender]);

  if (!shouldRender || fill === "unfilled") return null;

  // 完了画面用の帯。親の px-4 を打ち消して端まで伸ばし、区切り線で本文と分ける
  const variantClass =
    variant === "section"
      ? "mt-12 -mx-4 border-t border-gray-100 bg-gray-50/70 px-4 pt-7 pb-9"
      : "";

  return (
    <div
      className={`native-app-hidden ${variantClass} ${className}`}
      // 表示が確定するまで場所を確保し、後から要素が押し下げられるのを防ぐ
      style={{ minHeight: fill === "filled" ? undefined : 120 }}
    >
      <p
        className={`mb-1 text-[10px] uppercase tracking-widest text-gray-300 ${
          variant === "section" ? "text-center" : ""
        }`}
        style={{ visibility: fill === "filled" ? "visible" : "hidden" }}
      >
        スポンサー
      </p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
