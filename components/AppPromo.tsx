"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/ga";

const APP_STORE_URL = "https://apps.apple.com/jp/app/komaro/id6805110615";

/** iOS端末か。App Storeへの案内は、実際に入れられる人にだけ出す。 */
function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOSはMacintoshを名乗るため、タッチの有無で見分ける
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** すでにホーム画面から開いている（インストール済み）か。 */
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari の独自プロパティ
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * App Storeへの案内を出す端末か。
 *
 * 端末の種類は購読する必要がない外部の値なので `useSyncExternalStore` で読む。
 * 効果の中で `setState` すると、描画のあとにもう一度描画が走る（lintにも止められる）。
 */
const subscribeNothing = () => () => {};
const getIsIOSTarget = () => !isStandalone() && isIOS();
// サーバー側では端末が分からない。出さない側に倒す
const getIsIOSTargetOnServer = () => false;

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** 見た目の共通部分。広告ではないので「スポンサー」とは書かない。 */
function PromoCard({
  title,
  body,
  action,
  onClick,
  href,
}: {
  title: string;
  body: string;
  action: string;
  onClick: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <Image
        src="/icon-192.png"
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-[10px]"
      />
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{body}</p>
      </div>
      <span className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">
        {action}
      </span>
    </>
  );

  const className =
    // 説明文は1行に収まる長さにしてあり、この余白で高さ66pxに収まる。
    // 文言を長くすると折り返して2行になり、一気に84pxまで伸びるので注意。
    "flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 transition-colors hover:bg-gray-100";

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/**
 * 広告が出ないときに、その場所へ代わりに出す案内（自社枠）。
 *
 * - iOS：App Storeのアプリへ
 * - Android・PC：アプリとして追加（PWA）。Chromeが「入れられる」と判断したときだけ出す。
 *   文言は「ホーム画面に追加」とも「インストール」とも取れるものにしてある
 * - インストール済み：何も出さない
 *
 * AdSenseの審査が通れば本物の広告が入り、この案内は出なくなる。
 */
export function AppPromo({ placement, className = "" }: { placement: string; className?: string }) {
  const ios = useSyncExternalStore(subscribeNothing, getIsIOSTarget, getIsIOSTargetOnServer);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    if (ios || isStandalone()) return;

    // Androidなどで「ホーム画面に追加」が可能になったときに届く。
    // 既にインストール済み・条件を満たさない場合は発火しないので、
    // 入れられる人にだけ案内が出る。
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [ios]);

  if (ios) {
    return (
      <div className={`native-app-hidden ${className}`}>
        <PromoCard
          title="iPhoneアプリがあります"
          body="見たイベントがすぐ開けます"
          action="入手"
          href={APP_STORE_URL}
          onClick={() => trackEvent("app_promo_click", { placement, kind: "ios" })}
        />
      </div>
    );
  }

  if (installPrompt) {
    return (
      <div className={`native-app-hidden ${className}`}>
        <PromoCard
          title="アプリとして追加できます"
          body="次から1タップで開けます"
          action="追加"
          onClick={async () => {
            trackEvent("app_promo_click", { placement, kind: "pwa" });
            await installPrompt.prompt();
            const { outcome } = await installPrompt.userChoice;
            trackEvent("app_promo_result", { placement, outcome });
            setInstallPrompt(null);
          }}
        />
      </div>
    );
  }

  return null;
}
