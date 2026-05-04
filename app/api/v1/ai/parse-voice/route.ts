import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

// ── 型定義 ────────────────────────────────────
interface AvailabilityItem {
  type: "available" | "busy";
  days: string[];        // ["月曜", "水曜"] or ["all"]
  timeStart: string | null; // "HH:MM" or null (= 制限なし)
  timeEnd: string | null;
}

// ── セルマッピング用ヘルパー ──────────────────

const DAY_CHARS = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** Gemini が返した曜日/日付文字列が KOMARO の列ラベルと一致するか判定 */
function dayHintMatchesLabel(hint: string, colLabel: string): boolean {
  if (hint === "all") return true;
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
  // 日付照合: "5/7", "5月7日"
  const dm = hint.match(/(\d{1,2})[/月](\d{1,2})/);
  if (dm) {
    const d = `${parseInt(dm[1])}/${parseInt(dm[2])}`;
    if (colLabel.startsWith(d) || colLabel.startsWith(`0${d}`)) return true;
  }
  return false;
}

/** 行ラベルから開始分（0時からの分数）を取得 */
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

/** "HH:MM" → 分数 */
function hhmmToMinutes(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
}

/** 行が指定の時間範囲に含まれるか（rowLabels 全体を渡すことで行の「幅」を計算） */
function rowInRange(
  ri: number,
  rowLabels: string[],
  timeStart: string | null,
  timeEnd: string | null
): boolean {
  if (!timeStart && !timeEnd) return true;

  const rowStart = rowToMinutes(rowLabels[ri]);
  if (rowStart === null) return true; // パース不能は含める

  // 行の終端 = 次の行の開始、なければ行開始 + 60 分
  const nextStart = ri + 1 < rowLabels.length ? rowToMinutes(rowLabels[ri + 1]) : null;
  const rowEnd = nextStart ?? rowStart + 60;

  const evStart = hhmmToMinutes(timeStart) ?? 0;
  const evEnd   = hhmmToMinutes(timeEnd)   ?? 24 * 60;

  // 重なりあり: 行開始 < イベント終了 AND 行終了 > イベント開始
  return rowStart < evEnd && rowEnd > evStart;
}

/** Gemini の AvailabilityItem 一覧からセットを構築 */
function buildCellSet(
  items: AvailabilityItem[],
  rowLabels: string[],
  colLabels: string[]
): Set<string> {
  // available items がある → それらの和集合
  // busy items がある → available から差し引く
  // available items が空で busy だけ → 全セルから busy を除く
  const hasAvailable = items.some((i) => i.type === "available");

  const available = new Set<string>();

  if (!hasAvailable) {
    // 全セルを初期値にして busy を除く
    rowLabels.forEach((_, ri) => colLabels.forEach((_, ci) => available.add(`${ri}-${ci}`)));
  }

  for (const item of items) {
    for (let ri = 0; ri < rowLabels.length; ri++) {
      for (let ci = 0; ci < colLabels.length; ci++) {
        const dayOk = item.days.some((d) => dayHintMatchesLabel(d, colLabels[ci]));
        const timeOk = rowInRange(ri, rowLabels, item.timeStart, item.timeEnd);
        if (!dayOk || !timeOk) continue;

        if (item.type === "available") {
          available.add(`${ri}-${ci}`);
        } else {
          available.delete(`${ri}-${ci}`);
        }
      }
    }
  }

  return available;
}

// ── API ハンドラ ────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const rl = rateLimit({ key: `ai-voice:${ip}`, limit: 30, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 });

  const { transcript, rowLabels, colLabels } = await req.json();

  // Gemini には「構造化データの抽出」だけを頼む
  const prompt = `ユーザーの空き時間の発言を構造化データに変換してください。

【発言】「${transcript}」

【ルール】
- type: "available"（空き）または "busy"（予定あり）
- days: 曜日・日付を配列で。全日なら ["all"]。複数可。
  例: "月曜と水曜" → ["月曜","水曜"]、"全部" → ["all"]
- timeStart/timeEnd: "HH:MM" 形式。指定なしは null。
  "午前中" → timeStart:"06:00" timeEnd:"12:00"
  "午後" → timeStart:"12:00" timeEnd:"19:00"
  "夕方" → timeStart:"17:00" timeEnd:"21:00"
  "夜" → timeStart:"19:00" timeEnd:"24:00"
  "朝" → timeStart:"06:00" timeEnd:"10:00"
  "昼" → timeStart:"11:00" timeEnd:"14:00"
  "〜時以降" → timeStart:"HH:00" timeEnd:null
  "〜時まで" → timeStart:null timeEnd:"HH:00"

【出力形式】JSON のみ（説明不要）:
{"items":[{"type":"available","days":["all"],"timeStart":null,"timeEnd":null}],"interpretation":"解釈の説明（日本語）"}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
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
    const parsed = JSON.parse(text) as { items?: AvailabilityItem[]; interpretation?: string };

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return NextResponse.json({ availableCells: [], interpretation: "解析できませんでした" });
    }

    // TypeScript 側で正確にセルマッピング
    const available = buildCellSet(parsed.items, rowLabels as string[], colLabels as string[]);
    const availableCells = Array.from(available).map((key) => {
      const [row, col] = key.split("-").map(Number);
      return { row, col };
    });

    return NextResponse.json({ availableCells, interpretation: parsed.interpretation ?? "" });
  } catch (e) {
    console.error("parse-voice error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
