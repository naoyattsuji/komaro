type GtagParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dataLayer?: any[];
  }
}

export function trackEvent(name: string, params?: GtagParams) {
  if (typeof window === "undefined") return;
  // GAスクリプトより先にuseEffectが動く競争状態を回避するため、
  // dataLayerキューを直接初期化してイベントを積む
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function (...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }
  window.gtag("event", name, params);
}
