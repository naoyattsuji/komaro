import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KOMARO — コマで見る日程調整",
    short_name: "KOMARO",
    description: "会員登録不要・URL共有で使える日程調整サービス。全員の空き時間をコマの色で可視化します。",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111827",
    // purpose が maskable のものしか無いと、Chromeが「ホーム画面に追加」を
    // 提案しない（purpose any の適切なアイコンが要る）。両方を並べる。
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
