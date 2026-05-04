import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

interface AvailabilityItem {
  type: "available" | "busy";
  days: string[];           // ["月曜","水曜"] or ["all"]
  timeStart: string | null; // "HH:MM" or null
  timeEnd: string | null;
}

// ─── セルマッピング（TypeScript で正確に計算）─────────────────────────────────

const DAY_CHARS = ["月", "火", "水", "木", "金", "土", "日"] as const;

function dayMatchesCol(hint: string, colLabel: string): boolean {
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
  // 日付照合: "5/7" "5月7日"
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

function hhToMin(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : null;
}

/** 行が時間範囲と重なるか（次の行との差から行幅を計算） */
function rowInRange(ri: number, rowLabels: string[], timeStart: string | null, timeEnd: string | null): boolean {
  if (!timeStart && !timeEnd) return true;
  const rs = rowToMin(rowLabels[ri]);
  if (rs === null) return true;
  const nextRs = ri + 1 < rowLabels.length ? rowToMin(rowLabels[ri + 1]) : null;
  const re = nextRs ?? rs + 60;
  const ts = hhToMin(timeStart) ?? 0;
  const te = hhToMin(timeEnd)   ?? 24 * 60;
  return rs < te && re > ts;
}

function buildCells(items: AvailabilityItem[], rowLabels: string[], colLabels: string[]): { row: number; col: number }[] {
  const hasAvailable = items.some(i => i.type === "available");
  const set = new Set<string>();

  // available items がなければ全セルから始めて busy を除く
  if (!hasAvailable) {
    rowLabels.forEach((_, ri) => colLabels.forEach((_, ci) => set.add(`${ri}-${ci}`)));
  }

  for (const item of items) {
    for (let ri = 0; ri < rowLabels.length; ri++) {
      for (let ci = 0; ci < colLabels.length; ci++) {
        const dayOk  = item.days.some(d => dayMatchesCol(d, colLabels[ci]));
        const timeOk = rowInRange(ri, rowLabels, item.timeStart, item.timeEnd);
        if (!dayOk || !timeOk) continue;
        item.type === "available" ? set.add(`${ri}-${ci}`) : set.delete(`${ri}-${ci}`);
      }
    }
  }

  return Array.from(set).map(k => { const [row, col] = k.split("-").map(Number); return { row, col }; });
}

// ─── Gemini 呼び出し ────────────────────────────────────────────────────────

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
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
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

// ─── API ハンドラ ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const rl = rateLimit({ key: `ai-voice:${ip}`, limit: 30, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 });

  const { transcript, rowLabels, colLabels } = await req.json();

  // 候補日程を Gemini に渡す（曜日マッチングの精度向上）
  const dateContext = (colLabels as string[]).map((l: string) => `  • ${l}`).join("\n");

  const prompt = `あなたはスケジュール調整の空き時間解析専門家です。
ユーザーの発言から空き・予定情報を正確に構造化してください。

【このイベントの候補日程】
${dateContext}

【ユーザーの発言】
「${transcript}」

【時間キーワード変換表】
  朝・早朝     → 06:00〜09:00
  午前・午前中  → 06:00〜12:00
  昼・お昼     → 11:00〜14:00
  午後         → 12:00〜18:00
  夕方         → 17:00〜20:00
  夜           → 19:00〜24:00
  終日・丸一日  → null〜null
  〜時以降     → "HH:00"〜null
  〜時まで     → null〜"HH:00"

【重要ルール】
- 「〜以外は空き」パターン: まず全体を available にし、除外部分を busy で追加する
- 複数の時間帯が列挙される場合は items を複数作る
- 曖昧な表現は広めに解釈する（「昼頃」→ 11:00〜14:00）
- 発言に曜日の言及がなければ days: ["all"]

【出力形式】JSONのみ（説明テキスト不要）:
{"reasoning":"ステップバイステップの解釈","items":[{"type":"available","days":["all"],"timeStart":null,"timeEnd":null}],"interpretation":"解釈の要約（日本語1文）"}

【具体例】
「月曜の10時から12時は空いてます」
→ {"items":[{"type":"available","days":["月曜"],"timeStart":"10:00","timeEnd":"12:00"}],"interpretation":"月曜10〜12時が空き"}

「水曜は全部大丈夫です」
→ {"items":[{"type":"available","days":["水曜"],"timeStart":null,"timeEnd":null}],"interpretation":"水曜終日空き"}

「火曜以外は全部空いてます」
→ {"items":[{"type":"available","days":["all"],"timeStart":null,"timeEnd":null},{"type":"busy","days":["火曜"],"timeStart":null,"timeEnd":null}],"interpretation":"火曜以外は終日空き"}

「月曜と木曜の午後だけ空いてます」
→ {"items":[{"type":"available","days":["月曜","木曜"],"timeStart":"12:00","timeEnd":"18:00"}],"interpretation":"月・木の午後が空き"}

「午前中と夕方以降は空いてます」
→ {"items":[{"type":"available","days":["all"],"timeStart":"06:00","timeEnd":"12:00"},{"type":"available","days":["all"],"timeStart":"17:00","timeEnd":null}],"interpretation":"午前と夕方以降が空き"}

「今週月水金の14時以降しか空いてません」
→ {"items":[{"type":"available","days":["月曜","水曜","金曜"],"timeStart":"14:00","timeEnd":null}],"interpretation":"月水金14時以降が空き"}`;

  try {
    let text = await callGemini(apiKey, prompt);

    // 1回目が失敗・空なら簡易プロンプトで再試行
    if (!text) {
      text = await callGemini(apiKey,
        `発言「${transcript}」の空き時間情報をJSONで: {"items":[{"type":"available","days":["all"],"timeStart":null,"timeEnd":null}],"interpretation":""}`
      );
    }

    if (!text) return NextResponse.json({ error: "gemini_error" }, { status: 500 });

    const parsed = JSON.parse(text) as { items?: AvailabilityItem[]; interpretation?: string; reasoning?: string };
    const items  = parsed.items ?? [];
    const availableCells = buildCells(items, rowLabels as string[], colLabels as string[]);

    return NextResponse.json({
      availableCells,
      interpretation: parsed.interpretation ?? "",
      reasoning: parsed.reasoning ?? "",
    });
  } catch (e) {
    console.error("parse-voice error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
