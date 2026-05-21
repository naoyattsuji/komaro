"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

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
