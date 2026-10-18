"use client";

import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
 * `?ads=preview` が付いているか。
 *
 * 枠の位置を実機で見て確認するための表示専用モード。広告ユニットIDが
 * 未設定の枠も含めて、ダミーの枠を描画する。**AdSenseへのリクエストは一切行わない**ため、
 * 無効なインプレッションが発生する心配はない。
 */
const getAdPreview = () =>
  new URLSearchParams(window.location.search).get("ads") === "preview";

/**
 * 画面幅の条件を満たしているか。
 *
 * CSSで隠すのではなく描画自体をやめる。display:noneの中で広告を要求すると、
 * 見えていない広告のリクエストが発生してAdSenseのポリシー上の問題になるため。
 */
function subscribeMediaQuery(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

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
  minWidth,
}: {
  placement: AdPlacement;
  className?: string;
  /**
   * inline: 本文の流れの中にそのまま置く。
   * section: 完了画面など下に余白が余る画面向け。区切り線と薄い背景で
   *          「ここから先はアプリの中身ではない」と分かる帯にする。
   */
  variant?: "inline" | "section";
  /**
   * この画面幅（px）未満では描画しない。PC専用の枠に使う。
   * CSSで隠すのではなく要素ごと出さないため、見えない広告の要求が発生しない。
   */
  minWidth?: number;
}) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);
  const [fill, setFill] = useState<FillState>("pending");

  const isNativeApp = useSyncExternalStore(
    subscribeNothing,
    getIsNativeApp,
    getIsNativeAppOnServer
  );

  // subscribe が毎描画で新しい関数になると購読し直しが走るので固定する
  const subscribeWidth = useMemo(
    () => (minWidth ? subscribeMediaQuery(`(min-width: ${minWidth}px)`) : subscribeNothing),
    [minWidth]
  );
  const getWidthOk = useCallback(
    () => (minWidth ? window.matchMedia(`(min-width: ${minWidth}px)`).matches : true),
    [minWidth]
  );
  // サーバー側では画面幅が分からない。幅の条件がある枠は描画しない側に倒す
  const getWidthOkOnServer = useCallback(() => !minWidth, [minWidth]);

  const widthOk = useSyncExternalStore(subscribeWidth, getWidthOk, getWidthOkOnServer);

  const isPreview = useSyncExternalStore(subscribeNothing, getAdPreview, () => false);

  const configured = isAdPlacementConfigured(placement);
  const slotId = AD_SLOTS[placement];
  // プレビューは枠の位置を見るためのものなので、ID未設定の枠も描画する
  const shouldRender = (configured || isPreview) && !isNativeApp && widthOk;

  useEffect(() => {
    if (!shouldRender || isPreview || pushedRef.current) return;
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
  }, [shouldRender, isPreview]);

  if (!shouldRender || (!isPreview && fill === "unfilled")) return null;

  // 完了画面用の帯。親の px-4 を打ち消して端まで伸ばし、区切り線で本文と分ける
  const variantClass =
    variant === "section"
      ? "mt-12 -mx-4 border-t border-gray-100 bg-gray-50/70 px-4 pt-7 pb-9"
      : "";

  // 位置確認用のダミー枠。AdSenseのコードは一切読み込まない
  if (isPreview) {
    return (
      <div className={`native-app-hidden ${variantClass} ${className}`}>
        <div
          className="flex h-[250px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-red-400 bg-red-50/60"
        >
          <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-400">スポンサー</p>
          <p className="text-sm font-bold text-red-500">広告枠</p>
          <p className="mt-0.5 font-mono text-[11px] text-red-400">{placement}</p>
          {!configured && (
            <p className="mt-2 text-[11px] text-gray-400">（この枠はまだ有効にしていません）</p>
          )}
        </div>
      </div>
    );
  }

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
