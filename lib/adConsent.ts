/*
 * パーソナライズ広告を出してよいかの判断（純粋な関数だけ）。
 *
 * - 個人向け（npa: false）にするのは ATT で「許可」された人だけ
 * - EEA・英国・スイスの端末地域では ATT を出さず、非パーソナライズのまま（同意画面 UMP が未導入のため）
 * - 地域が分からないときは、安全な側（非パーソナライズ・ATT なし）に倒す
 */

export type TrackingStatus = "authorized" | "denied" | "notDetermined" | "restricted";

const CONSENT_REGIONS = new Set([
  // EU
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EU の地域で、ISO の地域コードが別のもの
  "AX", "GF", "GP", "MQ", "RE", "YT", "MF",
  // EEA のうち EU 以外
  "IS", "LI", "NO",
  // 英国と王室属領・ジブラルタル
  "GB", "GG", "IM", "JE", "GI",
  // スイス
  "CH",
]);

/** 同意の画面が必要な地域か。地域が不明なら true（安全な側） */
export function isConsentRegion(region: string | null | undefined): boolean {
  if (!region) return true;
  return CONSENT_REGIONS.has(region.toUpperCase());
}

/** ATT の画面を出すか */
export function shouldRequestTracking(region: string | null | undefined, status: TrackingStatus): boolean {
  return !isConsentRegion(region) && status === "notDetermined";
}

/** 非パーソナライズ（npa: true）にするか */
export function isNonPersonalized(region: string | null | undefined, status: TrackingStatus): boolean {
  return isConsentRegion(region) || status !== "authorized";
}
