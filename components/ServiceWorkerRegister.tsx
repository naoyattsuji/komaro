"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

/**
 * Service Workerの登録。
 *
 * Androidの「ホーム画面に追加」をChromeが提案する条件を満たすために要る（`public/sw.js`）。
 *
 * **ネイティブアプリの中では登録しない。** アプリは同じ `komaro.app` をWebViewで開くため、
 * 登録するとアプリ側のオフライン表示（Capacitorの `errorPath`）と二重になる。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator)) return;

    // 表示を優先し、読み込みが落ち着いてから登録する
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 登録できなくてもサイトの利用には影響しない
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
