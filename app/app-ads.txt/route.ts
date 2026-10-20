import { AD_CLIENT } from "@/lib/ads";

/**
 * AdMobの app-ads.txt を配信する。
 *
 * ads.txt のアプリ版。App Storeに載っているデベロッパーのサイト
 * （KOMAROの場合 https://komaro.app）のルートに置くことで、
 * 「このアプリの広告枠を売る権限を持つ事業者」をAdMobへ宣言する。
 *
 * これが無いとAdMobでアプリの確認が通らず、広告配信が制限される。
 * 中身は ads.txt と同じ行で、パブリッシャーIDもAdSenseと共通。
 */
export const dynamic = "force-dynamic";

export function GET() {
  // AD_CLIENT は "ca-pub-..." 形式。app-ads.txt では "pub-..." を使う。
  const publisherId = AD_CLIENT.replace(/^ca-/, "");

  if (!publisherId.startsWith("pub-")) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
