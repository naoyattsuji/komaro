import { isNonPersonalized, shouldRequestTracking, type TrackingStatus } from "@/lib/adConsent";

/*
 * ATT（App Tracking Transparency）の確認と、広告の npa の決定。起動ごとに1回だけ動く。
 *
 * AdTrackingGate はアプリ本体に入っている窓口（AdTrackingGatePlugin.swift）。
 * NSUserTrackingUsageDescription と同じ版から入るので、この窓口が無いアプリでは ATT を呼ばない。
 * 説明文の無いアプリで ATT を呼ぶと iOS がアプリを落とす。
 */

interface AdTrackingGatePlugin {
  /** アプリが active になったら、端末の地域（ISO コード。不明なら空）を返す */
  whenActive(): Promise<{ region: string }>;
}

async function decide(): Promise<boolean> {
  const { Capacitor, registerPlugin } = await import("@capacitor/core");
  if (Capacitor.getPlatform() !== "ios" || !Capacitor.isPluginAvailable("AdTrackingGate")) return true;

  const gate = registerPlugin<AdTrackingGatePlugin>("AdTrackingGate");
  const { region } = await gate.whenActive();

  const { AdMob } = await import("@capacitor-community/admob");
  const read = async (): Promise<TrackingStatus> => (await AdMob.trackingAuthorizationStatus()).status;

  let status = await read();
  if (shouldRequestTracking(region, status)) {
    await AdMob.requestTrackingAuthorization();
    status = await read();
  }
  return isNonPersonalized(region, status);
}

let decided: Promise<boolean> | null = null;

/** 広告を非パーソナライズにするか。失敗したら非パーソナライズ */
export function adNonPersonalized(): Promise<boolean> {
  decided ??= decide().catch(() => true);
  return decided;
}
