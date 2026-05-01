import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/participants/[participantId]">
) {
  const { eventId, participantId } = await ctx.params;

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
    include: { cells: { select: { rowIndex: true, colIndex: true } } },
  });

  if (!participant) {
    return Response.json(
      { error: { code: "PARTICIPANT_NOT_FOUND", message: "参加者が見つかりません" } },
      { status: 404 }
    );
  }

  return Response.json({
    participant: {
      id: participant.id,
      name: participant.name,
      cells: participant.cells,
      createdAt: participant.createdAt.toISOString(),
      updatedAt: participant.updatedAt.toISOString(),
    },
  });
}

export async function PUT(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/participants/[participantId]">
) {
  const { eventId, participantId } = await ctx.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
  });
  if (!event) {
    return Response.json(
      { error: { code: "EVENT_NOT_FOUND", message: "イベントが見つかりません" } },
      { status: 404 }
    );
  }
  if (event.status === "expired") {
    return Response.json(
      { error: { code: "EVENT_EXPIRED", message: "このイベントは期限切れです" } },
      { status: 410 }
    );
  }

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
  });
  if (!participant) {
    return Response.json(
      { error: { code: "PARTICIPANT_NOT_FOUND", message: "参加者が見つかりません" } },
      { status: 404 }
    );
  }

  const body = await req.json();
  const { name, cells = [] } = body;

  if (name && name !== participant.name) {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "参加者名を変更することはできません" } },
      { status: 400 }
    );
  }

  await prisma.availabilityCell.deleteMany({ where: { participantId } });
  if (cells.length > 0) {
    await prisma.availabilityCell.createMany({
      data: cells.map((c: { rowIndex: number; colIndex: number }) => ({
        participantId,
        eventId,
        rowIndex: c.rowIndex,
        colIndex: c.colIndex,
      })),
    });
  }

  await prisma.participant.update({
    where: { id: participantId },
    data: { updatedAt: new Date() },
  });
  await prisma.event.update({
    where: { id: eventId },
    data: { lastUpdatedAt: new Date() },
  });

  return Response.json({ participant: { id: participantId, name: participant.name } });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/participants/[participantId]">
) {
  const { eventId, participantId } = await ctx.params;

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
  });
  if (!participant) {
    return Response.json(
      { error: { code: "PARTICIPANT_NOT_FOUND", message: "参加者が見つかりません" } },
      { status: 404 }
    );
  }

  await prisma.participant.delete({ where: { id: participantId } });
  await prisma.event.update({
    where: { id: eventId },
    data: { lastUpdatedAt: new Date() },
  });

  return new Response(null, { status: 204 });
}
