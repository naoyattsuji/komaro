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

  const rowList = (rowLabels as string[])
    .map((l: string, i: number) => `  row[${i}]: "${l}"`)
    .join("\n");
  const colList = (colLabels as string[])
    .map((l: string, i: number) => `  col[${i}]: "${l}"`)
    .join("\n");

  const prompt = `The user is telling you about their available (free) time slots.

User said: "${transcript}"

The scheduling grid has:
Rows (time slots):
${rowList}

Columns (dates or days):
${colList}

Instructions:
- Identify which cells the user is available for based on what they said.
- If the user mentions being BUSY or having a schedule for certain times, do NOT include those cells.
- If no specific day/column is mentioned, apply to ALL columns.
- If no specific time is mentioned, apply to ALL rows.
- Match partial or colloquial time references (e.g. "午前中"=morning, "午後"=afternoon, "夕方"=evening).
- Match day-of-week references to the column labels (e.g. "月曜" matches a column labeled "月" or "月曜" or "5/7(月)").

Return ONLY valid JSON with no markdown:
{"availableCells": [{"row": 0, "col": 0}], "interpretation": "brief Japanese explanation of what you understood"}`;

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
      const err = await res.text();
      console.error("Gemini error:", err);
      return NextResponse.json({ error: "gemini_error" }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("parse-voice error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
