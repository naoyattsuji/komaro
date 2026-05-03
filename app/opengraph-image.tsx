import { ImageResponse } from "next/og";

export const runtime = "edge";
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

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: "system-ui, -apple-system, sans-serif",
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
              padding: "8px 22px",
              marginBottom: "40px",
              width: "fit-content",
              fontSize: "18px",
              color: "#9ca3af",
              letterSpacing: "0.1em",
            }}
          >
            Schedule Coordination
          </div>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "36px" }}>
            <div
              style={{
                width: "76px",
                height: "76px",
                background: "#111827",
                borderRadius: "18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "40px",
                fontWeight: 900,
                color: "#ffffff",
              }}
            >
              K
            </div>
            <span style={{ fontSize: "60px", fontWeight: 900, color: "#111827", letterSpacing: "-0.03em" }}>
              KOMARO
            </span>
          </div>

          {/* Tagline — ASCII only, no Japanese font needed */}
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#374151", marginBottom: "16px" }}>
            Scheduling made visual.
          </div>
          <div style={{ fontSize: "22px", color: "#9ca3af" }}>
            No sign-up required. Just share a URL.
          </div>

          {/* URL */}
          <div
            style={{
              display: "flex",
              marginTop: "48px",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "18px",
              color: "#6b7280",
              width: "fit-content",
            }}
          >
            komaro.vercel.app
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
            <div style={{ display: "flex" }}>
              <div style={{ width: "68px" }} />
              {cols.map((c) => (
                <div
                  key={c}
                  style={{
                    width: "72px",
                    textAlign: "center",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#6b7280",
                    paddingBottom: "8px",
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
                    height: "64px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "13px",
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
                      height: "64px",
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
    { ...size }
  );
}
