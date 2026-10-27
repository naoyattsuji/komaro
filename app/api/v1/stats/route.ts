import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/*
 * 管理画面（ads.naoya-tsuji.com）に「数の合計だけ」を返す読むだけの窓口。
 * 合言葉そのものはここに置かず、指紋（sha256）だけを置く。合言葉は管理画面の環境変数 STATS_TOKEN。
 * 予定の中身・参加者の名前は返さない。
 */
const TOKEN_SHA256 = "33c046986bf8110ca128e019aa375df7b11e3fb7433ba8cd24fceb44ea39cd29";

export const dynamic = "force-dynamic";

function allowed(req: Request): boolean {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const got = createHash("sha256").update(auth.slice(7)).digest();
  return timingSafeEqual(got, Buffer.from(TOKEN_SHA256, "hex"));
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

export async function GET(req: Request) {
  if (!allowed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const live = { deletedAt: null };
  const [events, new1, new7, new30, participants, p1, p7, p30] = await Promise.all([
    prisma.event.count({ where: live }),
    prisma.event.count({ where: { ...live, createdAt: { gte: daysAgo(1) } } }),
    prisma.event.count({ where: { ...live, createdAt: { gte: daysAgo(7) } } }),
    prisma.event.count({ where: { ...live, createdAt: { gte: daysAgo(30) } } }),
    prisma.participant.count(),
    prisma.participant.count({ where: { createdAt: { gte: daysAgo(1) } } }),
    prisma.participant.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    prisma.participant.count({ where: { createdAt: { gte: daysAgo(30) } } }),
  ]);

  // 管理画面の共通の形（Supabase の dashboard_stats と同じ）。KOMARO はアカウントが無いので「人」は回答した人
  return NextResponse.json(
    {
      users: participants,
      new7: p7,
      new30: p30,
      active1: p1,
      active7: p7,
      active30: p30,
      extra: [
        { label: "予定（作成）", value: events },
        { label: "予定（7日間）", value: new7 },
        { label: "予定（30日間）", value: new30 },
        { label: "予定（今日）", value: new1 },
      ],
    },
    { headers: { "cache-control": "no-store" } },
  );
}
