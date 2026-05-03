import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ヒートマップのカラースキーム（トップページ準拠）
const HEAT_COLORS = [
  "#f3f4f6", "#e5e7eb", "#9ca3af",
  "#4b5563", "#dc2626", "#e5e7eb",
  "#9ca3af", "#f3f4f6", "#4b5563",
  "#dc2626", "#e5e7eb", "#9ca3af",
  "#f3f4f6", "#4b5563", "#e5e7eb",
  "#dc2626", "#9ca3af", "#f3f4f6",
  "#4b5563", "#e5e7eb", "#dc2626",
  "#9ca3af", "#f3f4f6", "#4b5563",
];

async function loadFont(): Promise<ArrayBuffer | null> {
  const text = encodeURIComponent(
    "コマで見る日程調整登録不要URLを送るだけ全員の空き時間ひと目確認イベントを作成する KOMARO0123456789ScheduleCoordinatin."
  );
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${text}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; U; Android 4.1; en-us; GT-N7100 Build/JRO03C) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30",
        },
      }
    ).then((r) => r.text());
    const url = css.match(/url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    return fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/** 左右の装飾グリッド（フル表示時のみ見える） */
function DecoGrid({ cols, rows }: { cols: number; rows: number }) {
  const cells: { color: string; i: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ color: HEAT_COLORS[(r * cols + c) % HEAT_COLORS.length], i: r * cols + c });
    }
  }
  const SIZE = 44;
  const GAP = 5;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${GAP}px` }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: `${GAP}px` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              style={{
                width: `${SIZE}px`,
                height: `${SIZE}px`,
                background: HEAT_COLORS[(r * cols + c) % HEAT_COLORS.length],
                borderRadius: "6px",
                opacity: 0.55,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function OgImage() {
  const logoBuffer = fs.readFileSync(path.join(process.cwd(), "public/komaro-logo.png"));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const fontData = await loadFont();
  const fonts = fontData
    ? [{ name: "JP", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "JP, sans-serif" : "sans-serif";

  return new ImageResponse(
    (
      <div style={{ background: "#ffffff", width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: ff }}>

        {/* 上部アクセントバー（全幅） */}
        <div style={{ height: "6px", background: "#111827", width: "100%", display: "flex" }} />

        <div style={{ flex: 1, display: "flex" }}>

          {/* ── 左装飾（x:0〜285 フル表示のみ） ── */}
          <div
            style={{
              width: "285px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* グラデーションオーバーレイ */}
            <div style={{ position: "absolute", left: 0, top: 0, width: "285px", height: "630px", backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.85) 100%)", display: "flex", zIndex: 1 }} />
            <DecoGrid cols={4} rows={7} />
          </div>

          {/* ── 中央セーフゾーン（x:285〜915 = 630px） ── */}
          <div
            style={{
              width: "630px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 40px",
              gap: "0px",
            }}
          >
            {/* ロゴ + サービス名 */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} width={52} height={52} style={{ objectFit: "contain" }} alt="" />
              <span style={{ fontSize: "42px", fontWeight: 700, color: "#111827", letterSpacing: "-0.025em" }}>
                KOMARO
              </span>
            </div>

            {/* Eyebrow ラベル */}
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "18px" }}>
              Schedule Coordination
            </span>

            {/* メインヘッドライン */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontSize: "62px",
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.08,
                letterSpacing: "-0.025em",
                marginBottom: "22px",
                textAlign: "center",
              }}
            >
              <span>コマで見る、</span>
              <span>日程調整。</span>
            </div>

            {/* サブテキスト */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginBottom: "36px" }}>
              <span style={{ fontSize: "18px", color: "#4b5563", textAlign: "center" }}>
                誰がいつ空いているか、コマの色で一発確認。
              </span>
              <span style={{ fontSize: "16px", color: "#9ca3af" }}>
                登録不要 · URLを送るだけ
              </span>
            </div>

            {/* CTA ボタン */}
            <div
              style={{
                display: "flex",
                background: "#111827",
                borderRadius: "9px",
                padding: "15px 32px",
                fontSize: "18px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.01em",
              }}
            >
              イベントを作成する →
            </div>
          </div>

          {/* ── 右装飾（x:915〜1200 フル表示のみ） ── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* グラデーションオーバーレイ */}
            <div style={{ position: "absolute", right: 0, top: 0, width: "285px", height: "630px", backgroundImage: "linear-gradient(to left, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.85) 100%)", display: "flex", zIndex: 1 }} />
            <DecoGrid cols={4} rows={7} />
          </div>

        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
