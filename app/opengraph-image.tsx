import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ── Demo heatmap data ────────────────────────────────────────────
const cols = ["5/7(水)", "5/8(木)", "5/9(金)", "5/10(土)"];
const rows = ["10:00", "12:00", "14:00", "16:00", "18:00"];
const data = [
  [3, 8, 10, 5],
  [7, 10,  6, 3],
  [5,  6, 10, 8],
  [10, 7,  4, 6],
  [3, 10,  9, 4],
];
const MAX = 10;

function cellBg(v: number) {
  const r = v / MAX;
  if (r === 0)    return "#ffffff";
  if (r <= 0.25)  return "#f3f4f6";
  if (r <= 0.5)   return "#d1d5db";
  if (r <= 0.75)  return "#9ca3af";
  if (r < 1)      return "#4b5563";
  return "#dc2626";
}

function cellFg(v: number) {
  return v / MAX <= 0.4 ? "#374151" : "#ffffff";
}

export default async function OgImage() {
  // Load Noto Sans JP (supports Japanese characters)
  const fontBold = await fetch(
    "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansjp/NotoSansJP-Bold.ttf"
  ).then((r) => r.arrayBuffer()).catch(() => null);

  const fonts = fontBold
    ? [{ name: "NotoSansJP", data: fontBold, weight: 700 as const, style: "normal" as const }]
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: fontBold ? "NotoSansJP" : "system-ui, sans-serif",
          padding: "0",
        }}
      >
        {/* ── Left panel ─────────────────────────────────── */}
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
              padding: "6px 18px",
              marginBottom: "36px",
              width: "fit-content",
              fontSize: "18px",
              color: "#9ca3af",
              letterSpacing: "0.12em",
            }}
          >
            Schedule Coordination
          </div>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "32px" }}>
            <div
              style={{
                width: "68px",
                height: "68px",
                background: "#111827",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "36px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              K
            </div>
            <span style={{ fontSize: "54px", fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
              KOMARO
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: "40px",
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.25,
              marginBottom: "24px",
            }}
          >
            コマで見る、日程調整。
          </div>

          {/* Description */}
          <div style={{ fontSize: "22px", color: "#9ca3af", lineHeight: 1.7 }}>
            登録不要・URLを送るだけ。
          </div>
          <div style={{ fontSize: "22px", color: "#9ca3af" }}>
            全員の空き時間をひと目で確認。
          </div>
        </div>

        {/* ── Right panel: heatmap ───────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "460px",
            background: "#f9fafb",
            borderLeft: "1px solid #f3f4f6",
            padding: "48px 40px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
            {/* Header row */}
            <div style={{ display: "flex", marginBottom: "0px" }}>
              <div style={{ width: "72px" }} />
              {cols.map((c) => (
                <div
                  key={c}
                  style={{
                    width: "72px",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#6b7280",
                    paddingBottom: "8px",
                  }}
                >
                  {c}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {rows.map((r, ri) => (
              <div key={r} style={{ display: "flex" }}>
                {/* Row label */}
                <div
                  style={{
                    width: "72px",
                    height: "60px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#9ca3af",
                  }}
                >
                  {r}
                </div>
                {/* Cells */}
                {data[ri].map((v, ci) => (
                  <div
                    key={ci}
                    style={{
                      width: "72px",
                      height: "60px",
                      background: cellBg(v),
                      border: "1px solid #e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
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
