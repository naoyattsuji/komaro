import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const rl = rateLimit({ key: `ai-voice:${ip}`, limit: 30, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  const { transcript, rowLabels, colLabels } = await req.json();

  // 全セルを列挙して渡す（インデックスを推測させない）
  const cellList = (rowLabels as string[]).flatMap((row: string, ri: number) =>
    (colLabels as string[]).map((col: string, ci: number) =>
      `  {"row":${ri},"col":${ci}}  →  時間帯:「${row}」 / 日付・曜日:「${col}」`
    )
  ).join("\n");

  const prompt = `あなたはスケジュール調整アシスタントです。
ユーザーが自分の空き時間を話してくれました。以下のセル一覧から、ユーザーが「空いている」セルを選んでください。

【ユーザーの発言】
「${transcript}」

【選択可能なセル一覧】
${cellList}

【ルール】
- ユーザーが「空いてる」「大丈夫」「OK」など空きを示す発言をした時間帯・曜日のセルを選ぶ
- ユーザーが「予定がある」「無理」「NG」「埋まってる」など予定を示す発言をした時間帯・曜日は選ばない
- 曜日の照合: 「月曜」→「月」「(月)」「月曜」「月曜日」を含む列に一致
- 時間の照合: 「10時から12時」→ 10:00以上12:00未満の行に一致、「午前」→ 12:00より前、「午後」→ 12:00以降
- 特定の日・時間への言及がなければ全セルを対象にする
- 必ず上記セル一覧の row と col の数値をそのまま使うこと（自分で計算しない）

以下のJSON形式のみで返答してください（他のテキスト不要）:
{"availableCells":[{"row":0,"col":0}],"interpretation":"発言の解釈を日本語で一言"}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
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
    console.error("parse-voice error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
