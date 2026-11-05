"use client";

import Image from "next/image";
import { trackEvent } from "@/lib/ga";

const APP_STORE_URL = "https://apps.apple.com/jp/app/komaro/id6805110615";

/**
 * 広告が出ないときに、その場所へ代わりに出すiOSアプリの案内（自社枠）。
 *
 * 広告ではないので「スポンサー」とは書かない。AdSenseの審査が通れば本物の広告が
 * 入り、この案内は出なくなる（`AdSlot` が広告の有無を見て切り替える）。
 */
export function AppPromo({ placement }: { placement: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("app_promo_click", { placement })}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3.5 transition-colors hover:bg-gray-100"
    >
      <Image
        src="/icon-192.png"
        alt=""
        width={44}
        height={44}
        className="h-11 w-11 shrink-0 rounded-[10px]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900">iPhoneアプリがあります</p>
        <p className="mt-0.5 text-xs text-gray-500">
          ホーム画面から開けて、見たイベントがすぐ出ます
        </p>
      </div>
      <span className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">
        入手
      </span>
    </a>
  );
}
