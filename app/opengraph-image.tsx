import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ヒートマップデータ（トップページ DemoTable 準拠のグレースキーム）
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
  if (r <= 0.25) return "#f3f4f6";
  if (r <= 0.5)  return "#e5e7eb";
  if (r <= 0.75) return "#9ca3af";
  if (r < 1)     return "#4b5563";
  return "#dc2626";
}
function cellFg(v: number) {
  const r = v / MAX;
  if (r <= 0.5) return "#4b5563";
  return "#ffffff";
}

async function loadFont(): Promise<ArrayBuffer | null> {
  const text = encodeURIComponent(
    "コマで見る日程調整登録不要URLを送るだけ全員の空き時間ひと目確認無料イベントを作成する KOMARO水木金土:."
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
      <div
        style={{
          background: "#ffffff",
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: ff,
        }}
      >
        {/* ═══ 左側：1:1 クロップ時のセーフゾーン（630×630px） ═══ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "630px",
            height: "630px",
            padding: "56px 60px",
            borderRight: "1px solid #f3f4f6",
          }}
        >
          {/* ロゴ + サービス名 */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={44} height={44} style={{ objectFit: "contain" }} alt="" />
            <span style={{ fontSize: "36px", fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
              KOMARO
            </span>
          </div>

          {/* メインコピー */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "18px" }}>
              Schedule Coordination
            </span>
            <div style={{ display: "flex", flexDirection: "column", fontSize: "58px", fontWeight: 700, color: "#111827", lineHeight: 1.05, letterSpacing: "-0.025em", marginBottom: "24px" }}>
              <span>コマで見る、</span>
              <span>日程調整。</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "19px", color: "#4b5563", lineHeight: 1.5 }}>
                誰がいつ空いているか、コマの色で一発確認。
              </span>
              <span style={{ fontSize: "17px", color: "#9ca3af" }}>
                登録不要 · URLを送るだけ
              </span>
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              display: "flex",
              background: "#111827",
              borderRadius: "8px",
              padding: "14px 28px",
              fontSize: "17px",
              fontWeight: 700,
              color: "#ffffff",
              alignSelf: "flex-start",
            }}
          >
            イベントを作成する →
          </div>
        </div>

        {/* ═══ 右側：装飾ヒートマップ（1:1クロップでは非表示） ═══ */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            background: "#fafafa",
            padding: "48px 40px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* 列ヘッダー */}
            <div style={{ display: "flex", marginBottom: "2px" }}>
              <div style={{ width: "52px" }} />
              {cols.map((c) => (
                <div
                  key={c}
                  style={{
                    width: "60px",
                    textAlign: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#9ca3af",
                    paddingBottom: "8px",
                  }}
                >
                  {c}
                </div>
              ))}
            </div>
            {/* データ行 */}
            {rows.map((r, ri) => (
              <div key={r} style={{ display: "flex", marginBottom: "2px" }}>
                <div
                  style={{
                    width: "52px",
                    height: "48px",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "11px",
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
                      width: "58px",
                      height: "48px",
                      background: cellBg(v),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: cellFg(v),
                      margin: "1px",
                      borderRadius: "4px",
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
