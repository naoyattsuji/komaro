import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyEditJwt } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function getEvent(eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
  });
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]">
) {
  const { eventId } = await ctx.params;
  const event = await getEvent(eventId);

  if (!event) {
    return Response.json(
      { error: { code: "EVENT_NOT_FOUND", message: "イベントが見つかりません" } },
      { status: 404 }
    );
  }

  const participantCount = await prisma.participant.count({
    where: { eventId },
  });

  return Response.json({
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      tableType: event.tableType,
      rowLabels: JSON.parse(event.rowLabels),
      colLabels: JSON.parse(event.colLabels),
      rowMeta: event.rowMeta ? JSON.parse(event.rowMeta) : null,
      colMeta: event.colMeta ? JSON.parse(event.colMeta) : null,
      maxParticipants: event.maxParticipants,
      currentParticipantCount: participantCount,
      status: event.status,
      hasPassword: !!event.passwordHash,
      lastUpdatedAt: event.lastUpdatedAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]">
) {
  const { eventId } = await ctx.params;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const payload = token ? await verifyEditJwt(token) : null;
  if (!payload || payload.eventId !== eventId) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "編集権限がありません" } },
      { status: 401 }
    );
  }

  const event = await getEvent(eventId);
  if (!event) {
    return Response.json(
      { error: { code: "EVENT_NOT_FOUND", message: "イベントが見つかりません" } },
      { status: 404 }
    );
  }

  const body = await req.json();
  const participantCount = await prisma.participant.count({ where: { eventId } });

  const updateData: Record<string, unknown> = { lastUpdatedAt: new Date() };

  if (body.title !== undefined) {
    if (!body.title?.trim()) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "イベント名は必須です" } },
        { status: 400 }
      );
    }
    updateData.title = body.title.trim();
  }
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;
  if (body.maxParticipants !== undefined) {
    const max = Number(body.maxParticipants);
    if (max < participantCount) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: `現在の参加者数（${participantCount}名）以上の値を設定してください` } },
        { status: 400 }
      );
    }
    updateData.maxParticipants = Math.max(1, Math.min(50, max));
  }
  if (body.password !== undefined) {
    updateData.passwordHash = body.password ? await bcrypt.hash(body.password, 12) : null;
  }
  if (body.rowLabels !== undefined) {
    updateData.rowLabels = JSON.stringify(body.rowLabels);
    updateData.rowMeta = body.rowMeta ? JSON.stringify(body.rowMeta) : null;
  }
  if (body.colLabels !== undefined) {
    updateData.colLabels = JSON.stringify(body.colLabels);
    updateData.colMeta = body.colMeta ? JSON.stringify(body.colMeta) : null;
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: updateData,
  });

  return Response.json({ event: { id: updated.id, title: updated.title } });
}

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]">
) {
  const { eventId } = await ctx.params;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const payload = token ? await verifyEditJwt(token) : null;
  if (!payload || payload.eventId !== eventId) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "編集権限がありません" } },
      { status: 401 }
    );
  }

  const event = await getEvent(eventId);
  if (!event) {
    return Response.json(
      { error: { code: "EVENT_NOT_FOUND", message: "イベントが見つかりません" } },
      { status: 404 }
    );
  }

  await prisma.event.update({
    where: { id: eventId },
    data: { status: "deleted", deletedAt: new Date() },
  });

  return new Response(null, { status: 204 });
}
