import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEAT: string[] = [
  "#f3f4f6", "#9ca3af", "#dc2626", "#e5e7eb",
  "#4b5563", "#e5e7eb", "#9ca3af", "#f3f4f6",
  "#dc2626", "#4b5563", "#f3f4f6", "#9ca3af",
  "#e5e7eb", "#dc2626", "#4b5563", "#e5e7eb",
  "#9ca3af", "#f3f4f6", "#e5e7eb", "#dc2626",
  "#4b5563", "#9ca3af", "#dc2626", "#f3f4f6",
  "#e5e7eb", "#4b5563", "#9ca3af", "#dc2626",
];

function colOpacity(col: number, totalCols: number, fromRight: boolean): number {
  const pos = fromRight ? col : totalCols - 1 - col;
  const ratio = pos / (totalCols - 1);
  return 0.65 - ratio * 0.55;
}

async function loadFont(extraChars: string): Promise<ArrayBuffer | null> {
  const base = "コマで見る日程調整登録不要URLを送るだけ参加して回答する人が回答中への招待募集中 KOMARO0123456789/(水木金土月火)年月日:.";
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

export default async function OgImage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { title: true },
  });

  const participantCount = event
    ? await prisma.participant.count({ where: { eventId } })
    : 0;

  const title = event?.title ?? "日程調整";

  // タイトルを2行に分割（1行最大13文字）
  const LINE_MAX = 13;
  let line1 = title;
  let line2 = "";
  if (title.length > LINE_MAX) {
    line1 = title.slice(0, LINE_MAX);
    const rest = title.slice(LINE_MAX);
    line2 = rest.length > LINE_MAX ? rest.slice(0, LINE_MAX - 1) + "…" : rest;
  }
  const titleFontSize = line2 ? 52 : 60;

  const logoBuffer = fs.readFileSync(path.join(process.cwd(), "public/komaro-logo.png"));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const fontData = await loadFont(title);
  const fonts = fontData
    ? [{ name: "JP", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "JP, sans-serif" : "sans-serif";

  const ROWS = 7;
  const COLS = 4;
  const CELL = 44;
  const GAP = 5;

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
        }}
      >
        {/* 上部アクセントバー */}
        <div style={{ height: "6px", background: "#111827", display: "flex" }} />

        <div style={{ flex: 1, display: "flex", alignItems: "stretch" }}>

          {/* 左装飾 */}
          <div
            style={{
              width: "285px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: "12px",
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
                        background: HEAT[(r * COLS + c) % HEAT.length],
                        borderRadius: "6px",
                        opacity: colOpacity(c, COLS, true),
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* 中央セーフゾーン（630px） */}
          <div
            style={{
              width: "630px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 44px",
            }}
          >
            {/* ブランド */}
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
                  fontSize: "32px",
                  fontWeight: 700,
                  color: "#9ca3af",
                  letterSpacing: "-0.02em",
                }}
              >
                KOMARO
              </span>
            </div>

            {/* ラベル */}
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#9ca3af",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              日程調整への招待
            </span>

            {/* タイトル */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                fontSize: `${titleFontSize}px`,
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.1,
                letterSpacing: "-0.025em",
                marginBottom: "28px",
              }}
            >
              <span>{line1}</span>
              {line2 && <span>{line2}</span>}
            </div>

            {/* 参加者バッジ */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#f3f4f6",
                borderRadius: "100px",
                padding: "8px 20px",
                fontSize: "16px",
                fontWeight: 700,
                color: "#4b5563",
                marginBottom: "32px",
              }}
            >
              {participantCount > 0
                ? `${participantCount}人が回答中`
                : "回答者募集中"}
            </div>

            {/* CTA */}
            <div
              style={{
                display: "flex",
                background: "#111827",
                borderRadius: "9px",
                padding: "15px 32px",
                fontSize: "18px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              参加して回答する →
            </div>
          </div>

          {/* 右装飾 */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingLeft: "12px",
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
                        background: HEAT[(r * COLS + c + 3) % HEAT.length],
                        borderRadius: "6px",
                        opacity: colOpacity(c, COLS, false),
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
