/**
 * 広告表示の設定と掲載ポリシー。
 *
 * 設計方針（詳細は docs/ads.md）:
 * - 環境変数が未設定なら一切表示しない。デフォルトは広告なし。
 * - 「作業の邪魔をしない位置」にだけ置く。操作対象（コマ・ボタン）の近くには置かない。
 * - 1画面につき1枠まで。インタースティシャル（全画面）や追従バナーは使わない。
 * - ネイティブアプリ内では表示しない。AdSenseの広告をアプリ内へ埋め込むことは
 *   ポリシー違反にあたるため、アプリで広告を出す場合はAdMobを別途導入する。
 */

/** 広告全体のオン・オフ。未設定時はオフ。 */
export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

/**
 * AdSenseのスクリプトが読み込まれる状態かどうか。
 *
 * パブリッシャーIDを設定した時点で、広告枠を出していなくてもスクリプトは読み込まれ、
 * Googleのcookieが入る。プライバシーポリシーの開示はこちらを基準にする
 * （ADS_ENABLED は「広告枠を出すか」なので、開示の基準としては遅すぎる）。
 */
export const ADS_SCRIPT_LOADED = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "") !== "";

/** AdSenseのパブリッシャーID（例: ca-pub-1234567890123456）。 */
export const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

/**
 * パーソナライズ広告を使うかどうか。既定はオフ（非パーソナライズのみ）。
 *
 * オフにしている理由:
 * - 端末をまたいだ広告トラッキングをしないため、iOSのATT許可ダイアログや
 *   App Storeの「トラッキング」申告が不要になる。
 * - EU/英国からのアクセスに対するGoogle認定CMP（同意管理）の要件を回避できる。
 * - 収益単価は下がるが、日程調整ツールという性質上、信頼性を優先する。
 */
export const ADS_PERSONALIZED = process.env.NEXT_PUBLIC_ADS_PERSONALIZED === "true";

/**
 * 掲載枠。値はAdSense管理画面で発行される広告ユニットID（数字列）。
 * 枠ごとに環境変数を分けているため、1枠ずつ試して効果を見ながら増やせる。
 */
export const AD_SLOTS = {
  /** 集計ページ最下部。コメント欄より下。閲覧数が最も多く、内容も充実している推奨枠。 */
  summaryBottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SUMMARY_BOTTOM ?? "",
  /** トップページ最下部。CTAの下。 */
  homeBottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_BOTTOM ?? "",
  /** ヘルプページ最下部。滞在時間が長く、読み物として成立している枠。 */
  helpBottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HELP_BOTTOM ?? "",
  /** 回答送信の完了画面。作業が終わった直後で、注意を奪っても損失が小さい。 */
  answerComplete: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ANSWER_COMPLETE ?? "",
  /** イベント作成の完了画面。URLのコピー導線より必ず下に置く。 */
  createComplete: process.env.NEXT_PUBLIC_ADSENSE_SLOT_CREATE_COMPLETE ?? "",
  /**
   * 集計表の直下（PCは左カラム内、スマホは表と参加者一覧の間）。
   * 表を見た直後で視線がそこにあるため最も見られるが、参加者一覧を下へ押し下げる。
   */
  summaryUnderTable: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SUMMARY_UNDER_TABLE ?? "",
  /**
   * 集計ページのサイドバー下部。**PC専用**（`minWidth` で768px未満では描画しない）。
   * もともと空いている余白のため、何も押し下げずに枠を増やせる。
   */
  summarySidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SUMMARY_SIDEBAR ?? "",
  /**
   * 回答画面・送信ボタンの下。
   *
   * 表示回数は多いが、全幅の送信ボタンの真下は親指の着地点にあたる。
   * 誤タップは広告主への無効クリックとして計上され、AdSenseアカウント停止の
   * 直接の原因になるため、**送信ボタンとの間に128pxの余白を必ず確保すること**。
   */
  answerBottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ANSWER_BOTTOM ?? "",
  /** トップページ中盤。機能紹介とCTAの間。読み物の切れ目で割り込み感が小さい。 */
  homeMiddle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_MIDDLE ?? "",
} as const;

export type AdPlacement = keyof typeof AD_SLOTS;

/** 指定枠を表示できる状態か（サーバー・クライアント共通の判定）。 */
export function isAdPlacementConfigured(placement: AdPlacement): boolean {
  return ADS_ENABLED && AD_CLIENT !== "" && AD_SLOTS[placement] !== "";
}
