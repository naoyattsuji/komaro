import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

interface CalendarEvent {
  dayHint: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
}

// ─── セルマッピング ──────────────────────────────────────────────────────────

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

function rowToMin(label: string): number | null {
  const m1 = label.match(/^(\d{1,2}):(\d{2})/);
  if (m1) return +m1[1] * 60 + +m1[2];
  const m2 = label.match(/(午前|午後)?(\d{1,2})時/);
  if (m2) {
    let h = +m2[2];
    if (m2[1] === "午後" && h !== 12) h += 12;
    if (m2[1] === "午前" && h === 12) h = 0;
    return h * 60;
  }
  const m3 = label.match(/^(\d{1,2})$/);
  if (m3 && +m3[1] <= 23) return +m3[1] * 60;
  return null;
}

function hhToMin(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : null;
}

function rowOverlapsEvent(ri: number, rowLabels: string[], ev: CalendarEvent): boolean {
  if (ev.isAllDay) return true;
  const rs = rowToMin(rowLabels[ri]);
  if (rs === null) return false;
  const nextRs = ri + 1 < rowLabels.length ? rowToMin(rowLabels[ri + 1]) : null;
  const re = nextRs ?? rs + 60;
  const es = hhToMin(ev.startTime) ?? 0;
  const ee = hhToMin(ev.endTime)   ?? es + 60;
  return rs < ee && re > es;
}

function eventsToFreeCells(
  events: CalendarEvent[],
  rowLabels: string[],
  colLabels: string[]
): { row: number; col: number }[] {
  const busy = new Set<string>();
  for (const ev of events) {
    for (let ci = 0; ci < colLabels.length; ci++) {
      if (!dayHintMatchesLabel(ev.dayHint, colLabels[ci])) continue;
      for (let ri = 0; ri < rowLabels.length; ri++) {
        if (rowOverlapsEvent(ri, rowLabels, ev)) busy.add(`${ri}-${ci}`);
      }
    }
  }
  const free: { row: number; col: number }[] = [];
  for (let ri = 0; ri < rowLabels.length; ri++) {
    for (let ci = 0; ci < colLabels.length; ci++) {
      if (!busy.has(`${ri}-${ci}`)) free.push({ row: ri, col: ci });
    }
  }
  return free;
}

// ─── Gemini 呼び出し ────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const md = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (md) return md[1];
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  return text;
}

async function callGeminiVision(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    }
  );
  if (!res.ok) { console.error("Gemini error:", await res.text()); return null; }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

// ─── API ハンドラ ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const rl = rateLimit({ key: `ai-calendar:${ip}`, limit: 20, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 });

  const { imageBase64, mimeType, rowLabels, colLabels } = await req.json();

  const targetDays  = (colLabels as string[]).join("、");
  const targetTimes = (rowLabels as string[]).join("、");

  // ── Pass 1: 詳細プロンプト ────────────────────────────────────────────────
  const prompt1 = `あなたはカレンダー解析の専門AIです。
このスクリーンショットから予定を網羅的に抽出してください。

【このスケジュール調整の対象日程】
${(colLabels as string[]).map((l: string) => `  • ${l}`).join("\n")}

【対象の時間帯】
${(rowLabels as string[]).map((l: string) => `  • ${l}`).join("\n")}

【抽出ルール】
1. 色付きブロック・テキスト・イベント名が見えるものをすべて予定として抽出する
2. 終日イベント（縦に伸びる全日バナー等）も isAllDay:true で抽出する
3. dayHint: スクリーンショット上の曜日・日付の表記をそのまま記載（例: "月","月曜","5/8","水曜日"）
4. 時間が読み取れない場合は isAllDay:true として扱う
5. 対象日程に含まれない日付のイベントは除外してよい
6. 空白のエリア（予定なし）は抽出しない

【出力形式】JSONのみ（説明文不要）:
{"events":[{"dayHint":"月曜","startTime":"10:00","endTime":"12:00","isAllDay":false}]}`;

  try {
    let text = await callGeminiVision(apiKey, imageBase64, mimeType ?? "image/jpeg", prompt1);
    let parsed: { events?: CalendarEvent[] } = {};

    try { if (text) parsed = JSON.parse(extractJSON(text)); } catch { parsed = {}; }

    // ── Pass 2: 0件ならより簡潔なプロンプトで再試行 ─────────────────────────
    if (!parsed.events || parsed.events.length === 0) {
      const prompt2 = `このカレンダー画像で、対象日程（${targetDays}）の${targetTimes}の時間帯に何か予定・イベント・色付きブロックはありますか？
あれば {"events":[{"dayHint":"曜日や日付","startTime":"HH:MM","endTime":"HH:MM","isAllDay":false}]} 形式で。なければ {"events":[]} で返してください。JSONのみ。`;

      text = await callGeminiVision(apiKey, imageBase64, mimeType ?? "image/jpeg", prompt2);
      try { if (text) parsed = JSON.parse(extractJSON(text)); } catch { parsed = {}; }
    }

    const events: CalendarEvent[] = parsed.events ?? [];
    const freeCells = eventsToFreeCells(events, rowLabels as string[], colLabels as string[]);

    return NextResponse.json({
      freeCells,
      extractedEvents: events.length,
      debug: `検出した予定: ${events.map(e => `${e.dayHint} ${e.startTime}〜${e.endTime}`).join(" / ") || "なし"}`,
    });
  } catch (e) {
    console.error("parse-calendar error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
