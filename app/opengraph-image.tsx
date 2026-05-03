import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ── Demo heatmap data ────────────────────────────────────────────
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
  if (r === 0)   return "#ffffff";
  if (r <= 0.25) return "#f3f4f6";
  if (r <= 0.5)  return "#d1d5db";
  if (r <= 0.75) return "#9ca3af";
  if (r < 1)     return "#4b5563";
  return "#dc2626";
}
function cellFg(v: number) {
  return v / MAX <= 0.4 ? "#374151" : "#ffffff";
}

// Load only the characters actually used in the image — keeps the font tiny
async function loadFont(): Promise<ArrayBuffer | null> {
  const chars = "コマで見る日程調整登録不要URLを送るだけ全員空き時間ひとで確認Schedule Coordination0123456789/(水木金土):KOMARO";
  try {
    // IE6 UA → Google Fonts returns woff (supported by ImageResponse)
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(chars)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)",
        },
      }
    ).then((r) => r.text());

    const url = css.match(/url\((.+?)\)/)?.[1];
    if (!url) return null;
    return fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OgImage() {
  const fontData = await loadFont();
  const fonts = fontData
    ? [{ name: "NotoSansJP", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "NotoSansJP, sans-serif" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: ff,
        }}
      >
        {/* ── Left panel ──────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "72px 64px",
            flex: 1,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "flex",
              background: "#f3f4f6",
              borderRadius: "100px",
              padding: "6px 20px",
              marginBottom: "36px",
              width: "fit-content",
              fontSize: "18px",
              color: "#9ca3af",
              letterSpacing: "0.1em",
            }}
          >
            Schedule Coordination
          </div>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "32px" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                background: "#111827",
                borderRadius: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "38px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              K
            </div>
            <span style={{ fontSize: "56px", fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
              KOMARO
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "42px",
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.25,
              marginBottom: "28px",
            }}
          >
            コマで見る、日程調整。
          </div>

          {/* Description */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "23px", color: "#9ca3af" }}>登録不要・URLを送るだけ。</span>
            <span style={{ fontSize: "23px", color: "#9ca3af" }}>全員の空き時間をひと目で確認。</span>
          </div>
        </div>

        {/* ── Right panel: heatmap ────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "460px",
            background: "#f9fafb",
            borderLeft: "1px solid #f3f4f6",
            padding: "48px 36px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", marginBottom: "2px" }}>
              <div style={{ width: "68px" }} />
              {cols.map((c) => (
                <div
                  key={c}
                  style={{
                    width: "72px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#6b7280",
                    paddingBottom: "6px",
                  }}
                >
                  {c}
                </div>
              ))}
            </div>

            {/* Rows */}
            {rows.map((r, ri) => (
              <div key={r} style={{ display: "flex" }}>
                <div
                  style={{
                    width: "68px",
                    height: "62px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#9ca3af",
                  }}
                >
                  {r}
                </div>
                {data[ri].map((v, ci) => (
                  <div
                    key={ci}
                    style={{
                      width: "72px",
                      height: "62px",
                      background: cellBg(v),
                      border: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: cellFg(v),
                    }}
                  >
                    {v}
                  </div>
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
