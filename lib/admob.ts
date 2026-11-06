/**
 * AdMob SDKの初期化を1回だけ行う。
 *
 * バナー（`NativeAdBanner`）と全画面広告（`NativeInterstitial`）の両方が
 * SDKを必要とするが、**初期化はアプリで1回だけ**でよい。
 *
 * ここに切り出した理由：以前はバナー側が初期化を抱えていたため、
 * **バナーを出さずに全画面広告だけを有効にすると、SDKが初期化されないまま
 * 広告の読み込みに失敗していた**。どちらか一方だけをオンにできる作りなので、
 * 初期化はどちらにも属さない場所に置く。
 */

let initPromise: Promise<void> | null = null;

export function ensureAdMobInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { AdMob } = await import("@capacitor-community/admob");
      await AdMob.initialize({ initializeForTesting: false });
    })().catch((error) => {
      // 失敗したら次の呼び出しでやり直せるようにする
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}
