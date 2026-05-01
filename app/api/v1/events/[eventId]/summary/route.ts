import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/summary">
) {
  const { eventId } = await ctx.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { rowLabels: true, colLabels: true, status: true },
  });

  if (!event) {
    return Response.json(
      { error: { code: "EVENT_NOT_FOUND", message: "イベントが見つかりません" } },
      { status: 404 }
    );
  }

  const cells = await prisma.availabilityCell.groupBy({
    by: ["rowIndex", "colIndex"],
    where: { eventId },
    _count: { id: true },
  });

  const maxCount = cells.reduce((max, c) => Math.max(max, c._count.id), 0);

  const cellsWithMax = cells.map((c) => ({
    rowIndex: c.rowIndex,
    colIndex: c.colIndex,
    count: c._count.id,
    isMax: c._count.id === maxCount && maxCount > 0,
  }));

  const participants = await prisma.participant.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      cells: { select: { rowIndex: true, colIndex: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    summary: {
      maxCount,
      cells: cellsWithMax,
    },
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      cells: p.cells,
    })),
  });
}
