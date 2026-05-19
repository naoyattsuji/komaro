import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateIcsContent } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/cal/[type]/[eventId]">
) {
  const { type, eventId } = await ctx.params;
  const { searchParams } = req.nextUrl;
  const s = searchParams.get("s") ?? "";
  const e = searchParams.get("e") ?? "";

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { title: true, description: true },
  });

  const rawTitle = event?.title ?? "日程調整";
  const title   = encodeURIComponent(rawTitle);
  const desc    = event?.description ? encodeURIComponent(event.description) : "";

  // ── Web calendar redirects ────────────────────────────────────────────────
  if (type === "google") {
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${s ? `&dates=${s}/${e}` : ""}${desc ? `&details=${desc}` : ""}`;
    return NextResponse.redirect(url, { status: 302 });
  }
  if (type === "yahoo") {
    const url = `https://calendar.yahoo.co.jp/?v=60&view=d&type=20&title=${title}${s ? `&st=${s}&et=${e}` : ""}${desc ? `&desc=${desc}` : ""}`;
    return NextResponse.redirect(url, { status: 302 });
  }
  if (type === "outlook") {
    const url = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}${s ? `&startdt=${s}&enddt=${e}` : ""}${desc ? `&body=${desc}` : ""}`;
    return NextResponse.redirect(url, { status: 302 });
  }

  // ── ICS landing page (apple / timetree / other) ───────────────────────────
  // LINEのインアプリブラウザでも動くよう https:// でHTMLを返し、
  // JS で webcal:// へ自動リダイレクト → iOS がカレンダーアプリを起動する
  if (type === "apple" || type === "timetree" || type === "other") {
    const host     = req.nextUrl.host;
    const qs       = s && e ? `?s=${s}&e=${e}` : "";
    const webcalUrl = `webcal://${host}/cal/mobile/${eventId}${qs}`;
    const icsUrl    = `https://${host}/cal/mobile/${eventId}${qs}`;

    const esc = (str: string) =>
      str.replace(/&/g, "&amp;").replace(/</g, "&lt;")
         .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const fmtIcs = (v: string) => {
      const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      return m ? `${m[1]}/${m[2]}/${m[3]} ${m[4]}:${m[5]}` : "";
    };
    const dateText = s && e
      ? `${fmtIcs(s)} 〜 ${fmtIcs(e).split(" ")[1]}`
      : "日時はイベントページで確認してください";

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(rawTitle)} – カレンダーに追加</title>
<script>window.location.href="${webcalUrl}";</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9fafb;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:16px;padding:32px 24px;max-width:360px;width:100%;box-shadow:0 1px 4px rgba(0,0,0,.08);text-align:center}
.logo{font-size:10px;font-weight:700;letter-spacing:.15em;color:#9ca3af;text-transform:uppercase;margin-bottom:20px}
h1{font-size:17px;font-weight:700;color:#111;line-height:1.45;margin-bottom:8px}
.date{font-size:13px;color:#6b7280;margin-bottom:24px}
a{display:flex;align-items:center;justify-content:center;width:100%;padding:14px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none}
.primary{background:#111;color:#fff;margin-bottom:10px}
.secondary{background:#f3f4f6;color:#374151}
.note{font-size:11px;color:#9ca3af;margin-top:16px;line-height:1.65}
</style>
</head>
<body>
<div class="card">
  <p class="logo">KOMARO</p>
  <h1>${esc(rawTitle)}</h1>
  <p class="date">${dateText}</p>
  <a href="${webcalUrl}" class="primary">カレンダーアプリで開く</a>
  <a href="${icsUrl}" class="secondary">ICSをダウンロード</a>
  <p class="note">自動で開かない場合は「カレンダーアプリで開く」をタップ。<br>TimeTreeはICSをダウンロード後、TimeTreeで開いてください。</p>
</div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ── Raw ICS (used internally by Calendar.app via webcal://) ───────────────
  if (type === "mobile") {
    const parseIcsDate = (v: string): Date | null => {
      const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
      if (!m) return null;
      return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    };
    const content = generateIcsContent({
      eventId,
      title: rawTitle,
      startDate: parseIcsDate(s),
      endDate:   parseIcsDate(e),
      description: event?.description ?? undefined,
    });
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${encodeURIComponent(rawTitle)}.ics"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
