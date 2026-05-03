import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const cols = ["5/7(水)", "5/8(木)", "5/9(金)", "5/10(土)"];
const rows = ["10:00", "12:00", "14:00", "16:00", "18:00"];
const data = [
  [3,  8, 10,  5],
  [7, 10,  6,  3],
  [5,  6, 10,  8],
  [10, 7,  4,  6],
  [3, 10,  9,  4],
];
const MAX = 10;

function cellBg(v: number) {
  const r = v / MAX;
  if (r === 0)   return "#1f2937";
  if (r <= 0.25) return "#374151";
  if (r <= 0.5)  return "#6b7280";
  if (r <= 0.75) return "#d1d5db";
  if (r < 1)     return "#f3f4f6";
  return "#ef4444";
}
function cellFg(v: number) {
  const r = v / MAX;
  return r <= 0.5 ? "#e5e7eb" : "#111827";
}

async function loadFont(): Promise<ArrayBuffer | null> {
  const text = encodeURIComponent(
    "コマで見る日程調整登録不要URLを送るだけ全員の空き時間ひと目確認無料今すぐ使う KOMARO0123456789/水木金土:."
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
      <div style={{ background: "#111827", width: "100%", height: "100%", display: "flex", fontFamily: ff, position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 15% 50%, rgba(220,38,38,0.12) 0%, transparent 55%)" }} />

        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "72px 68px", flex: 1, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "48px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={64} height={64} style={{ objectFit: "contain" }} alt="" />
            <span style={{ fontSize: "52px", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em" }}>KOMARO</span>
          </div>
          <div style={{ fontSize: "48px", fontWeight: 700, color: "#ffffff", lineHeight: 1.2, marginBottom: "24px" }}>
            コマで見る、{"\n"}日程調整。
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "22px", color: "#9ca3af" }}>誰がいつ空いているか、コマの色で一発確認。</span>
            <span style={{ fontSize: "22px", color: "#6b7280" }}>登録不要 · URLを送るだけ</span>
          </div>
          <div style={{ display: "flex", marginTop: "52px", background: "#dc2626", borderRadius: "10px", padding: "12px 28px", width: "fit-content", fontSize: "18px", fontWeight: 700, color: "#ffffff" }}>
            無料で今すぐ使う
          </div>
        </div>

        {/* Right: heatmap */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "420px", padding: "48px 32px" }}>
          <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>
            <div style={{ display: "flex", marginBottom: "4px" }}>
              <div style={{ width: "60px" }} />
              {cols.map((c) => (
                <div key={c} style={{ width: "66px", textAlign: "center", fontSize: "12px", fontWeight: 700, color: "#6b7280", paddingBottom: "8px" }}>{c}</div>
              ))}
            </div>
            {rows.map((r, ri) => (
              <div key={r} style={{ display: "flex" }}>
                <div style={{ width: "60px", height: "58px", display: "flex", alignItems: "center", fontSize: "12px", fontWeight: 700, color: "#4b5563" }}>{r}</div>
                {data[ri].map((v, ci) => (
                  <div key={ci} style={{ width: "66px", height: "58px", background: cellBg(v), borderRadius: (ri===0&&ci===0)?"6px 0 0 0":(ri===0&&ci===3)?"0 6px 0 0":(ri===4&&ci===0)?"0 0 0 6px":(ri===4&&ci===3)?"0 0 6px 0":"0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: cellFg(v), margin: "1px" }}>{v}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
