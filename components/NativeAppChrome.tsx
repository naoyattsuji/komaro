"use client";

import { Capacitor } from "@capacitor/core";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function NativeAppChrome() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    document.body.dataset.nativeApp = "true";
    return () => {
      delete document.body.dataset.nativeApp;
    };
  }, []);

  return null;
}

export function NativeBackButton() {
  const pathname = usePathname();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsNative(Capacitor.isNativePlatform());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const canGoBack = isNative && pathname !== "/";

  if (!canGoBack) return null;

  return (
    <button
      type="button"
      aria-label="前の画面に戻る"
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.location.href = "/";
      }}
      className="mr-1 -ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      <ChevronLeft size={22} />
    </button>
  );
}
