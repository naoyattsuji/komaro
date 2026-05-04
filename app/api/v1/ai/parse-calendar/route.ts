import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const rl = rateLimit({ key: `ai-calendar:${ip}`, limit: 20, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const { imageBase64, mimeType, rowLabels, colLabels } = await req.json();

  // 全セルを列挙して渡す（インデックスを推測させない）
  const cellList = (rowLabels as string[]).flatMap((row: string, ri: number) =>
    (colLabels as string[]).map((col: string, ci: number) =>
      `  {"row":${ri},"col":${ci}}  →  時間帯:「${row}」 / 日付・曜日:「${col}」`
    )
  ).join("\n");

  const prompt = `あなたはカレンダー解析AIです。
添付のカレンダースクリーンショットを見て、以下の各セルの時間帯が「空いているか（予定なし）」を判定してください。

【判定対象セル一覧】
${cellList}

【判定方法】
1. スクリーンショットのカレンダーで、各セルに対応する時間帯・日付のエリアを探す
2. そのエリアにイベント・予定・色付きブロック・テキストがあれば「予定あり（busy）」
3. 何も書かれていない・色がついていない空白であれば「空き（free）」
4. 判定できない場合は「空き」とみなす

【重要】
- カレンダーの時間軸（縦軸）を上記の時間帯と正確に照合すること
- 必ず上記セル一覧の row と col の数値をそのまま使うこと

空いているセルのみを以下のJSON形式で返してください（他のテキスト不要）:
{"freeCells":[{"row":0,"col":0}]}`;

  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: mimeType ?? "image/jpeg", data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    if (!res.ok) {
      console.error("Gemini error:", await res.text());
      return NextResponse.json({ error: "gemini_error" }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return NextResponse.json(JSON.parse(text));
  } catch (e) {
    console.error("parse-calendar error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
