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

  const rowList = (rowLabels as string[])
    .map((l: string, i: number) => `  row[${i}]: "${l}"`)
    .join("\n");
  const colList = (colLabels as string[])
    .map((l: string, i: number) => `  col[${i}]: "${l}"`)
    .join("\n");

  const prompt = `You are analyzing a calendar/schedule screenshot to identify FREE time slots.

The scheduling grid has:
Rows (time slots):
${rowList}

Columns (dates or days):
${colList}

Instructions:
- A cell is FREE if that time period appears empty in the calendar (no events, no colored blocks, no text indicating an appointment).
- A cell is BUSY if there is any event, appointment, or colored block visible in that time range.
- Match the calendar's visible time range to the row labels above.
- If you cannot determine a cell's status, assume it is FREE.

Return ONLY valid JSON with no markdown:
{"freeCells": [{"row": 0, "col": 0}]}`;

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
      const err = await res.text();
      console.error("Gemini error:", err);
      return NextResponse.json({ error: "gemini_error" }, { status: 500 });
    }

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("parse-calendar error:", e);
    return NextResponse.json({ error: "parse_error" }, { status: 500 });
  }
}
