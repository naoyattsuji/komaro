import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

// ── 型定義 ────────────────────────────────────
interface CalendarEvent {
  dayHint: string;       // カレンダー上の曜日・日付表記
  startTime: string;     // "HH:MM"
  endTime: string;       // "HH:MM"
  isAllDay?: boolean;
}

// ── セルマッピング用ヘルパー ──────────────────

const DAY_CHARS = ["月", "火", "水", "木", "金", "土", "日"] as const;

function dayHintMatchesLabel(hint: string, colLabel: string): boolean {
  if (!hint) return false;
  for (const dc of DAY_CHARS) {
    if (hint.includes(dc)) {
      if (
        colLabel === dc ||
        colLabel === `${dc}曜` ||
        colLabel === `${dc}曜日` ||
        colLabel.includes(`(${dc})`) ||
        colLabel.includes(`${dc}曜`)
      ) return true;
    }
  }
  const dm = hint.match(/(\d{1,2})[/月](\d{1,2})/);
  if (dm) {
    const d = `${parseInt(dm[1])}/${parseInt(dm[2])}`;
    if (colLabel.startsWith(d)) return true;
  }
  return false;
}

function rowToMinutes(label: string): number | null {
  const m1 = label.match(/^(\d{1,2}):(\d{2})/);
  if (m1) return parseInt(m1[1]) * 60 + parseInt(m1[2]);
  const m2 = label.match(/(午前|午後)?(\d{1,2})時/);
  if (m2) {
    let h = parseInt(m2[2]);
    if (m2[1] === "午後" && h !== 12) h += 12;
    if (m2[1] === "午前" && h === 12) h = 0;
    return h * 60;
  }
  const m3 = label.match(/^(\d{1,2})$/);
  if (m3) { const h = parseInt(m3[1]); if (h <= 23) return h * 60; }
  return null;
}

function hhmmToMinutes(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
}

/** 行がイベントと重なるか（行の「幅」を次の行から計算） */
function rowOverlapsEvent(
  ri: number,
  rowLabels: string[],
  event: CalendarEvent
): boolean {
  if (event.isAllDay) return true;

  const rowStart = rowToMinutes(rowLabels[ri]);
  if (rowStart === null) return false;

  const nextStart = ri + 1 < rowLabels.length ? rowToMinutes(rowLabels[ri + 1]) : null;
  const rowEnd = nextStart ?? rowStart + 60;

  const evStart = hhmmToMinutes(event.startTime) ?? 0;
  const evEnd   = hhmmToMinutes(event.endTime)   ?? evStart + 60;

  return rowStart < evEnd && rowEnd > evStart;
}

// ── API ハンドラ ────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const rl = rateLimit({ key: `ai-calendar:${ip}`, limit: 20, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 });

  const { imageBase64, mimeType, rowLabels, colLabels } = await req.json();

  // スキャン対象の日付・時間帯を Gemini に伝える
  const targetDays  = (colLabels as string[]).join("、");
  const targetTimes = (rowLabels as string[]).join("、");

  const prompt = `このカレンダーのスクリーンショットから、すべての予定・イベントを抽出してください。

【このスケジュール調整で関心のある日付/曜日】${targetDays}
【このスケジュール調整で関心のある時間帯】${targetTimes}

【抽出ルール】
- スクリーンショットに表示されているすべての予定・イベント・色付きブロックを抽出する
- dayHint: そのイベントが表示されている曜日または日付（例: "月曜日", "5/8", "水"）
- startTime/endTime: "HH:MM" 形式。読み取れない場合は "00:00"/"23:59"
- isAllDay: 終日イベントなら true
- 予定のない時間帯は含めない

【出力形式】JSON のみ（説明不要）:
{"events":[{"dayHint":"月曜日","startTime":"10:00","endTime":"12:00","isAllDay":false}]}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: mimeType ?? "image/jpeg", data: imageBase64 } },
              { text: prompt },
            ],
          }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      }
    );

    if (!res.ok) {
      console.error("Gemini error:", await res.text());
      return NextResponse.json({ error: "gemini_error" }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as { events?: CalendarEvent[] };
    const events: CalendarEvent[] = parsed.events ?? [];

    // TypeScript 側で正確にセルマッピング
    const rowLabelsArr = rowLabels as string[];
    const colLabelsArr = colLabels as string[];

    // busy セルを特定
    const busyCells = new Set<string>();
    for (const event of events) {
      for (let ci = 0; ci < colLabelsArr.length; ci++) {
        if (!dayHintMatchesLabel(event.dayHint, colLabelsArr[ci])) continue;
        for (let ri = 0; ri < rowLabelsArr.length; ri++) {
          if (rowOverlapsEvent(ri, rowLabelsArr, event)) {
            busyCells.add(`${ri}-${ci}`);
          }
        }
      }
    }

    // free = 全セル - busy
    const freeCells: { row: number; col: number }[] = [];
    for (let ri = 0; ri < rowLabelsArr.length; ri++) {
      for (let ci = 0; ci < colLabelsArr.length; ci++) {
        if (!busyCells.has(`${ri}-${ci}`)) {
          freeCells.push({ row: ri, col: ci });
        }
      }
    }

    return NextResponse.json({ freeCells, extractedEvents: events.length });
  } catch (e) {
    console.error("parse-calendar error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
