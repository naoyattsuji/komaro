import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont(extraChars: string): Promise<ArrayBuffer | null> {
  const base =
    "日程調整への招待コマで見るKOMARO人が回答中募集中参加して回答する→ 0123456789/(月火水木金土)年.";
  const text = encodeURIComponent(base + extraChars);
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

export default async function OgImage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  let event: { title: string } | null = null;
  let participantCount = 0;
  try {
    event = await prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: { title: true },
    });
    if (event) {
      participantCount = await prisma.participant.count({ where: { eventId } });
    }
  } catch {
    // DB 未接続時はフォールバック表示
  }

  const title = event?.title ?? "日程調整";

  // タイトル長に応じてフォントサイズを調整（手動改行なし・自然な折り返し）
  const titleSize =
    title.length <= 6  ? 96 :
    title.length <= 10 ? 82 :
    title.length <= 15 ? 68 : 56;

  const logoBuffer = fs.readFileSync(
    path.join(process.cwd(), "public/komaro-logo.png")
  );
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const fontData = await loadFont(title);
  const fonts = fontData
    ? [{ name: "JP", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "JP, sans-serif" : "sans-serif";

  const ROWS = 9;
  const COLS = 6;
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
          fontFamily: ff,
          overflow: "hidden",
        }}
      >
        {/* ─── 左: テキスト ─── */}
        <div
          style={{
            width: "650px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 48px 0 60px",
            borderRight: "1px solid #f3f4f6",
          }}
        >
          {/* ロゴ + ブランド名（両OGP共通スタイル） */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "28px",
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

          {/* 招待ラベル */}
          <div style={{ display: "flex", marginBottom: "18px" }}>
            <div
              style={{
                display: "flex",
                background: "#fef2f2",
                borderRadius: "8px",
                padding: "6px 18px",
              }}
            >
              <span
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#dc2626",
                  letterSpacing: "0.02em",
                }}
              >
                日程調整への招待
              </span>
            </div>
          </div>

          {/* イベントタイトル — 自然な折り返し・手動分割なし */}
          <div
            style={{
              display: "flex",
              marginBottom: "40px",
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
            }}
          >
            <span
              style={{
                fontSize: `${titleSize}px`,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {title}
            </span>
          </div>

          {/* 参加者数 + CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#f3f4f6",
                borderRadius: "100px",
                padding: "10px 22px",
                fontSize: "20px",
                fontWeight: 700,
                color: "#4b5563",
              }}
            >
              {participantCount > 0
                ? `${participantCount}人が回答中`
                : "回答者募集中"}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#111827",
                borderRadius: "10px",
                padding: "12px 24px",
                fontSize: "20px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              参加して回答する →
            </div>
          </div>
        </div>

        {/* ─── 右: グリッド装飾 ─── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
    ),
    { ...size, fonts }
  );
}
