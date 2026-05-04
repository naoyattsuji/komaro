import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

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

function extractJSON(text: string): string {
  const md = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (md) return md[1];
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  return text;
}

// ─── API ハンドラ ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const rl = rateLimit({ key: `ai-voice:${ip}`, limit: 30, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "no_api_key" }, { status: 503 });

  const { transcript, rowLabels, colLabels } = await req.json();

  const rows = rowLabels as string[];
  const cols = colLabels as string[];

  // ラベルをインデックス付きで渡す
  const rowContext = rows.map((l, i) => `  row${i} = "${l}"`).join("\n");
  const colContext = cols.map((l, i) => `  col${i} = "${l}"`).join("\n");

  const prompt = `あなたはスケジュール調整AIです。
以下のグリッドラベルとテキストをもとに、「空いている（参加可能）」セルのインデックスペアを全て返してください。

【時間帯ラベル】
${rowContext}

【日程ラベル】
${colContext}

【テキスト（全文を最後まで読んでから解釈すること）】
「${transcript}」

【ルール】
1. テキスト全体を読んでから解釈する。冒頭の単語だけで判断しない
2. 空き時間の発言 → 該当するrow/colインデックスペアをavailableCellsに列挙
3. 予定の列挙テキスト（カレンダー）→ 記載された予定以外の全セルを列挙
4. 「予定なし」「全て空き」→ 全row × 全colを列挙
5. 「〜以外は全部空き」→ 例外のrow/col以外の全ペアを列挙
6. 曜日・日付の言及がない場合 → 全colを対象にする
7. 複数の時間帯・曜日が列挙されている → それぞれ処理して全て含める

【出力形式】JSONのみ:
{"reasoning":"全文を読んだ上での判断根拠","availableCells":[{"row":0,"col":0},...],"interpretation":"解釈の要約（日本語1文）"}

【例1】
row0="9:00" row1="10:00" row2="11:00" / col0="月" col1="火" col2="水"
テキスト:「月曜の10時から12時は空いてます」
→ {"reasoning":"月曜(col0)のrow1(10:00)とrow2(11:00)が空き","availableCells":[{"row":1,"col":0},{"row":2,"col":0}],"interpretation":"月曜10〜12時が空き"}

【例2】
row0="9:00" row1="10:00" / col0="月" col1="火" col2="水"
テキスト:「火曜以外は全部空いてます」
→ {"reasoning":"全体からcol1(火曜)を除く。col0とcol2の全rowが空き","availableCells":[{"row":0,"col":0},{"row":1,"col":0},{"row":0,"col":2},{"row":1,"col":2}],"interpretation":"火曜以外の全コマが空き"}

【例3】
row0="9:00" row1="10:00" row2="11:00" / col0="月" col1="火"
テキスト:「月曜日の10時から11時に会議があります。」（カレンダー予定）
→ {"reasoning":"月曜(col0)row1(10:00)が予定あり(busy)。それ以外が空き","availableCells":[{"row":0,"col":0},{"row":2,"col":0},{"row":0,"col":1},{"row":1,"col":1},{"row":2,"col":1}],"interpretation":"月曜10時以外が空き"}

【例4】
row0="9:00" row1="10:00" / col0="月" col1="火"
テキスト:「予定なし」
→ {"reasoning":"予定がないため全セルが空き","availableCells":[{"row":0,"col":0},{"row":0,"col":1},{"row":1,"col":0},{"row":1,"col":1}],"interpretation":"全コマが空き"}`;

  try {
    let text = await callGemini(apiKey, prompt);

    // 失敗したらシンプルなプロンプトで再試行
    if (!text) {
      const simplePrompt = `以下のグリッドで「${transcript}」の空きセルをJSONで返してください。
時間帯: ${rows.map((l, i) => `row${i}="${l}"`).join(" ")}
日程: ${cols.map((l, i) => `col${i}="${l}"`).join(" ")}
形式: {"availableCells":[{"row":0,"col":0}],"interpretation":""}`;
      text = await callGemini(apiKey, simplePrompt);
    }

    if (!text) return NextResponse.json({ error: "gemini_error" }, { status: 500 });

    const parsed = JSON.parse(extractJSON(text)) as {
      availableCells?: { row: number; col: number }[];
      interpretation?: string;
      reasoning?: string;
    };

    // 範囲外インデックスを除外
    const availableCells = (parsed.availableCells ?? []).filter(
      ({ row, col }) =>
        Number.isInteger(row) && Number.isInteger(col) &&
        row >= 0 && row < rows.length &&
        col >= 0 && col < cols.length
    );

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
