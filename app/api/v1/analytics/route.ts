import { NextResponse } from "next/server";
import { fetchAnalytics } from "@/lib/ga-api";
import { prisma } from "@/lib/db";

const AUTH_TOKEN = "shin-cron-secret-2026";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${AUTH_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [ga, dbStats] = await Promise.all([
    fetchAnalytics(),
    getDbStats(),
  ]);

  return NextResponse.json({ ga, db: dbStats });
}

async function getDbStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, today, thisMonth, totalParticipants, activeEvents, avgResult] =
    await Promise.all([
      prisma.event.count({ where: { deletedAt: null } }),
      prisma.event.count({ where: { deletedAt: null, createdAt: { gte: todayStart } } }),
      prisma.event.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
      prisma.participant.count(),
      prisma.event.count({ where: { deletedAt: null, status: "active" } }),
      prisma.participant.groupBy({
        by: ["eventId"],
        _count: { id: true },
      }),
    ]);

  const avgParticipants =
    avgResult.length > 0
      ? avgResult.reduce((sum, r) => sum + r._count.id, 0) / avgResult.length
      : 0;

  return {
    events: {
      total,
      today,
      thisMonth,
      active: activeEvents,
    },
    participants: {
      total: totalParticipants,
      avgPerEvent: Math.round(avgParticipants * 10) / 10,
    },
  };
}
