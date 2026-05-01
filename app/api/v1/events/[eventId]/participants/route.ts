import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/participants">
) {
  const { eventId } = await ctx.params;

  const participants = await prisma.participant.findMany({
    where: { eventId },
    include: { cells: { select: { rowIndex: true, colIndex: true } } },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      cells: p.cells,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/participants">
) {
  const { eventId } = await ctx.params;

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

  const body = await req.json();
  const { name, cells = [], overwrite = false } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "参加者名は必須です" } },
      { status: 400 }
    );
  }
  if (name.trim().length > 30) {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "参加者名は30文字以内です" } },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();

  const existing = await prisma.participant.findFirst({
    where: { eventId, name: trimmedName },
  });

  if (existing && !overwrite) {
    return Response.json(
      { error: { code: "DUPLICATE_PARTICIPANT_NAME", message: "同じ名前の参加者が既にいます", participantId: existing.id } },
      { status: 409 }
    );
  }

  if (existing && overwrite) {
    await prisma.availabilityCell.deleteMany({ where: { participantId: existing.id } });
    if (cells.length > 0) {
      await prisma.availabilityCell.createMany({
        data: cells.map((c: { rowIndex: number; colIndex: number }) => ({
          participantId: existing.id,
          eventId,
          rowIndex: c.rowIndex,
          colIndex: c.colIndex,
        })),
      });
    }
    await prisma.participant.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
    await prisma.event.update({
      where: { id: eventId },
      data: { lastUpdatedAt: new Date() },
    });
    return Response.json({ participant: { id: existing.id, name: existing.name } });
  }

  const currentCount = await prisma.participant.count({ where: { eventId } });
  if (currentCount >= event.maxParticipants) {
    return Response.json(
      { error: { code: "PARTICIPANT_LIMIT_REACHED", message: `参加者上限（${event.maxParticipants}名）に達しています` } },
      { status: 422 }
    );
  }

  const participant = await prisma.participant.create({
    data: {
      eventId,
      name: trimmedName,
      cells: cells.length > 0
        ? {
            createMany: {
              data: cells.map((c: { rowIndex: number; colIndex: number }) => ({
                eventId,
                rowIndex: c.rowIndex,
                colIndex: c.colIndex,
              })),
            },
          }
        : undefined,
    },
  });

  await prisma.event.update({
    where: { id: eventId },
    data: { lastUpdatedAt: new Date() },
  });

  return Response.json({ participant: { id: participant.id, name: participant.name } }, { status: 201 });
}
