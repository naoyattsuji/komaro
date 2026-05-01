import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/cells/[rowIndex]/[colIndex]">
) {
  const { eventId, rowIndex, colIndex } = await ctx.params;

  const ri = parseInt(rowIndex, 10);
  const ci = parseInt(colIndex, 10);

  const allParticipants = await prisma.participant.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      cells: {
        where: { rowIndex: ri, colIndex: ci },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const available = allParticipants.filter((p) => p.cells.length > 0).map((p) => p.name);
  const unavailable = allParticipants.filter((p) => p.cells.length === 0).map((p) => p.name);

  return Response.json({ available, unavailable });
}
