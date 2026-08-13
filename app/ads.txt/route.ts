import { AD_CLIENT } from "@/lib/ads";

/**
 * AdSenseの ads.txt を配信する。
 *
 * ads.txt は「この広告枠を売る権限を持つ事業者」を宣言するファイルで、
 * 設置しないとAdSense側で警告が出て収益が制限される。
 * パブリッシャーIDを環境変数から組み立てるため、未設定なら404を返す。
 */
export const dynamic = "force-dynamic";

export function GET() {
  // AD_CLIENT は "ca-pub-..." 形式。ads.txt では "pub-..." を使う。
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
