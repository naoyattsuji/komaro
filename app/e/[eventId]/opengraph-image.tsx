import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont(): Promise<ArrayBuffer | null> {
  const text = encodeURIComponent(
    "コマで見る日程調整登録不要URLを送るだけ参加して回答する人が回答中への招待 KOMARO0123456789/(水木金土月火)年月日:."
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

export default async function OgImage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // イベント情報を取得
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { title: true, colLabels: true },
  });

  const participantCount = event
    ? await prisma.participant.count({ where: { eventId } })
    : 0;

  const title = event?.title ?? "日程調整";

  // 列ラベル（日付など）をパース
  let colLabels: string[] = [];
  try {
    if (event?.colLabels) {
      colLabels = JSON.parse(event.colLabels) as string[];
    }
  } catch { /* ignore */ }

  // 右パネルに表示するラベル（最大8件）
  const displayCols = colLabels.slice(0, 8);

  // タイトルを2行に分割（1行最大14文字）
  const LINE_MAX = 14;
  let line1 = title;
  let line2 = "";
  if (title.length > LINE_MAX) {
    line1 = title.slice(0, LINE_MAX);
    const rest = title.slice(LINE_MAX);
    line2 = rest.length > LINE_MAX ? rest.slice(0, LINE_MAX - 1) + "…" : rest;
  }

  const logoBuffer = fs.readFileSync(
    path.join(process.cwd(), "public/komaro-logo.png")
  );
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const fontData = await loadFont();
  const fonts = fontData
    ? [{ name: "JP", data: fontData, weight: 700 as const, style: "normal" as const }]
    : [];
  const ff = fontData ? "JP, sans-serif" : "sans-serif";

  const fontSize = line2 ? 54 : 62;

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
        {/* ═══ 左側：1:1 クロップ セーフゾーン（630×630px） ═══ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "630px",
            height: "630px",
            padding: "52px 60px",
            borderRight: "1px solid #f3f4f6",
          }}
        >
          {/* ブランド */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              width={38}
              height={38}
              style={{ objectFit: "contain" }}
              alt=""
            />
            <span
              style={{
                fontSize: "30px",
                fontWeight: 700,
                color: "#111827",
                letterSpacing: "-0.02em",
              }}
            >
              KOMARO
            </span>
          </div>

          {/* メインコンテンツ */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* ラベル */}
            <span
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#9ca3af",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              日程調整への招待
            </span>

            {/* イベントタイトル */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: `${fontSize}px`,
                fontWeight: 700,
                color: "#111827",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                marginBottom: "24px",
              }}
            >
              <span>{line1}</span>
              {line2 && <span>{line2}</span>}
            </div>

            {/* 参加者数バッジ */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#f3f4f6",
                  borderRadius: "100px",
                  padding: "6px 16px",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#4b5563",
                }}
              >
                {participantCount > 0
                  ? `${participantCount}人が回答中`
                  : "回答者募集中"}
              </div>
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
            参加して回答する →
          </div>
        </div>

        {/* ═══ 右側：装飾（1:1クロップでは非表示） ═══ */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#f9fafb",
            padding: "52px 40px",
            gap: "0px",
          }}
        >
          {displayCols.length > 0 ? (
            <>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#9ca3af",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  marginBottom: "20px",
                }}
              >
                候補日程
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
                {displayCols.map((label, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "10px 18px",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#374151",
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </>
          ) : (
            // フォールバック: 列ラベルがない場合はデコレーション
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {[["#f3f4f6","#e5e7eb","#dc2626"],["#e5e7eb","#9ca3af","#4b5563"],["#dc2626","#e5e7eb","#9ca3af"]].map(
                (row, ri) => (
                  <div key={ri} style={{ display: "flex", gap: "8px" }}>
                    {row.map((bg, ci) => (
                      <div
                        key={ci}
                        style={{
                          width: "72px",
                          height: "72px",
                          background: bg,
                          borderRadius: "8px",
                        }}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
