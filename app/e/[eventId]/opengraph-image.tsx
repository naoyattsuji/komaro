import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

function DecoGrid({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: "5px" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              style={{
                width: "44px",
                height: "44px",
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

export default async function OgImage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { title: true, colLabels: true },
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

  return new ImageResponse(
    (
      <div style={{ background: "#ffffff", width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: ff }}>

        {/* 上部アクセントバー */}
        <div style={{ height: "6px", background: "#111827", width: "100%", display: "flex" }} />

        <div style={{ flex: 1, display: "flex" }}>

          {/* ── 左装飾（フル表示のみ） ── */}
          <div style={{ width: "285px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: "285px", height: "630px", backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.85) 100%)", display: "flex", zIndex: 1 }} />
            <DecoGrid cols={4} rows={7} />
          </div>

          {/* ── 中央セーフゾーン（630px） ── */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} width={40} height={40} style={{ objectFit: "contain" }} alt="" />
              <span style={{ fontSize: "32px", fontWeight: 700, color: "#9ca3af", letterSpacing: "-0.02em" }}>
                KOMARO
              </span>
            </div>

            {/* ラベル */}
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#9ca3af", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: "16px" }}>
              日程調整への招待
            </span>

            {/* イベントタイトル */}
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
                textAlign: "center",
              }}
            >
              <span>{line1}</span>
              {line2 && <span>{line2}</span>}
            </div>

            {/* 参加者数バッジ */}
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
                marginBottom: "36px",
              }}
            >
              {participantCount > 0 ? `${participantCount}人が回答中` : "回答者募集中"}
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
                letterSpacing: "-0.01em",
              }}
            >
              参加して回答する →
            </div>
          </div>

          {/* ── 右装飾（フル表示のみ） ── */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: 0, top: 0, width: "285px", height: "630px", backgroundImage: "linear-gradient(to left, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.85) 100%)", display: "flex", zIndex: 1 }} />
            <DecoGrid cols={4} rows={7} />
          </div>

        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
