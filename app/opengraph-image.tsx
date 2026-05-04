import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont(): Promise<ArrayBuffer | null> {
  const text = encodeURIComponent(
    "コマで見る日程調整誰がいつ空いているか色で確認登録不要URLを送るだけ KOMARO0123456789·"
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

// 元の配色（赤多め・メリハリあり）
function getColor(r: number, c: number): string {
  const v = Math.sin(c * 1.2 + r * 0.8) * Math.cos(c * 0.6 - r * 0.5);
  if (v > 0.45) return "#111827";
  if (v > 0.1)  return "#dc2626";
  if (v > -0.2) return "#374151";
  if (v > -0.5) return "#9ca3af";
  return "#e5e7eb";
}

export default async function OgImage() {
  const logoBuffer = fs.readFileSync(
    path.join(process.cwd(), "public/komaro-logo.png")
  );
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const fontData = await loadFont();
  const fonts = fontData
    ? [{ name: "JP", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "JP, sans-serif" : "sans-serif";

  const ROWS = 9;
  const COLS = 7;
  const CELL = 70;
  const GAP = 8;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: ff,
          overflow: "hidden",
        }}
      >
        {/* 上部アクセントライン */}
        <div style={{ height: "6px", background: "#111827", display: "flex" }} />

        <div style={{ flex: 1, display: "flex" }}>

          {/* ─── 左: テキスト ─── */}
          <div
            style={{
              width: "570px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 0 0 56px",
            }}
          >
            {/* ロゴ + ブランド名（両OGP共通スタイル） */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "44px",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                width={40}
                height={40}
                style={{ objectFit: "contain" }}
                alt=""
              />
              <span
                style={{
                  fontSize: "34px",
                  fontWeight: 700,
                  color: "#9ca3af",
                  letterSpacing: "-0.02em",
                }}
              >
                KOMARO
              </span>
            </div>

            {/* メインコピー */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: "32px",
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
              }}
            >
              <span style={{ fontSize: "84px", fontWeight: 700, color: "#111827" }}>
                コマで見る、
              </span>
              <span style={{ fontSize: "84px", fontWeight: 700, color: "#dc2626" }}>
                日程調整。
              </span>
            </div>

            {/* サブコピー */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "22px", color: "#374151", letterSpacing: "-0.01em" }}>
                誰がいつ空いているか、コマの色でひと目確認。
              </span>
              <span style={{ fontSize: "20px", color: "#9ca3af" }}>
                登録不要 · URLを送るだけ
              </span>
            </div>
          </div>

          {/* ─── 右: グリッド装飾 ─── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingLeft: "36px",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: `${GAP}px` }}>
              {Array.from({ length: ROWS }).map((_, r) => (
                <div key={r} style={{ display: "flex", gap: `${GAP}px` }}>
                  {Array.from({ length: COLS }).map((_, c) => (
                    <div
                      key={c}
                      style={{
                        width: `${CELL}px`,
                        height: `${CELL}px`,
                        background: getColor(r, c),
                        borderRadius: "10px",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
