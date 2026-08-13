"use client";

import { Capacitor } from "@capacitor/core";
import Script from "next/script";
import { useSyncExternalStore } from "react";
import { AD_CLIENT } from "@/lib/ads";

// ネイティブ判定は購読不要の外部値。サーバー側は「ネイティブ扱い」にして読み込まない。
const subscribeNothing = () => () => {};
const getIsNativeApp = () => Capacitor.isNativePlatform();
const getIsNativeAppOnServer = () => true;

/**
 * AdSenseの本体スクリプト。
 *
 * パブリッシャーIDが設定されていれば、広告枠の有無にかかわらず読み込む。
 * AdSenseのアカウント審査は「サイトにこのコードが入っていること」を条件にするため、
 * 審査中（広告枠のIDがまだ無い状態）でも読み込める必要があるため。
 *
 * ネイティブアプリ内では読み込まない。AdSenseの広告をアプリ内に表示することは
 * ポリシー違反にあたり、Webサイト側を含むアカウント停止の理由になりうる。
 */
export function AdSenseScript() {
  const isNativeApp = useSyncExternalStore(
    subscribeNothing,
    getIsNativeApp,
    getIsNativeAppOnServer
  );

  if (!AD_CLIENT || isNativeApp) return null;

  return (
    <Script
      id="adsbygoogle-init"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}
