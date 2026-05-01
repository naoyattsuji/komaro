import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/participants/by-name">
) {
  const { eventId } = await ctx.params;
  const name = req.nextUrl.searchParams.get("name");

  if (!name) {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "名前が必要です" } },
      { status: 400 }
    );
  }

  const participant = await prisma.participant.findFirst({
    where: { eventId, name: name.trim() },
    include: { cells: { select: { rowIndex: true, colIndex: true } } },
  });

  if (!participant) {
    return Response.json(
      { error: { code: "PARTICIPANT_NOT_FOUND", message: "入力された名前の参加者が見つかりません" } },
      { status: 404 }
    );
  }

  return Response.json({
    participant: {
      id: participant.id,
      name: participant.name,
      cells: participant.cells,
    },
  });
}
