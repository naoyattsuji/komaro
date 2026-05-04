import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

// ─── Gemini Vision 呼び出し ────────────────────────────────────────────────

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
        generationConfig: { temperature: 0 },
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

  const prompt = `あなたはカレンダー解析の専門AIです。
このカレンダーのスクリーンショットに写っている「予定・イベント・予約済みスロット」を全て読み取り、日本語テキストとして列挙してください。

【このスケジュール調整の対象日程】
${(colLabels as string[]).map((l: string) => `  • ${l}`).join("\n")}

【対象の時間帯】
${(rowLabels as string[]).map((l: string) => `  • ${l}`).join("\n")}

【抽出ルール】
1. 色付きブロック・テキスト・イベント名など「予定が入っている」と判断できる要素を全て抽出する
2. 終日イベントは「〇曜日（または日付） 終日」と記述する
3. 対象日程・時間帯に含まれない予定は除外してよい
4. 予定が1つも見当たらない場合は「予定なし」とだけ返す
5. 空き時間（予定なしのスロット）は書かない

【出力形式】自然な日本語テキストのみ（JSONや箇条書き記号は不要）
例: 月曜日の10時から12時に会議があります。火曜日は終日予定が入っています。水曜日の14時から16時にミーティングがあります。`;

  try {
    let text = await callGeminiVision(apiKey, imageBase64, mimeType ?? "image/jpeg", prompt);

    // 0件 or 失敗なら簡易プロンプトで再試行
    if (!text || text.trim() === "") {
      text = await callGeminiVision(
        apiKey,
        imageBase64,
        mimeType ?? "image/jpeg",
        `このカレンダー画像の対象日程（${(colLabels as string[]).join("、")}）に予定・イベントはありますか？あれば日本語で列挙してください。なければ「予定なし」と返してください。`
      );
    }

    return NextResponse.json({
      eventText: text?.trim() ?? "予定なし",
    });
  } catch (e) {
    console.error("parse-calendar error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
