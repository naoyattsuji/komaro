import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * カレンダー短縮リダイレクト
 * /cal/google/[eventId]?s=20260507T100000&e=20260507T110000
 * /cal/yahoo/[eventId]?s=...&e=...
 * /cal/outlook/[eventId]?s=...&e=...
 */
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

  const title = encodeURIComponent(event?.title ?? "日程調整");
  const desc  = event?.description ? encodeURIComponent(event.description) : "";

  let url: string;
  switch (type) {
    case "google":
      url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${s ? `&dates=${s}/${e}` : ""}${desc ? `&details=${desc}` : ""}`;
      break;
    case "yahoo":
      url = `https://calendar.yahoo.co.jp/?v=60&view=d&type=20&title=${title}${s ? `&st=${s}&et=${e}` : ""}${desc ? `&desc=${desc}` : ""}`;
      break;
    case "outlook":
      url = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}${s ? `&startdt=${s}&enddt=${e}` : ""}${desc ? `&body=${desc}` : ""}`;
      break;
    default:
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  return NextResponse.redirect(url, { status: 302 });
}
