import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyEditJwt } from "@/lib/auth";
import bcrypt from "bcryptjs";

function buildLabelMap(oldLabels: string[], newLabels: string[]): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (let i = 0; i < oldLabels.length; i++) {
    const ni = newLabels.indexOf(oldLabels[i]);
    if (ni === -1) map.set(i, null);       // label removed
    else if (ni !== i) map.set(i, ni);     // label moved
    // unchanged: omit from map
  }
  return map;
}

async function remapCells(
  eventId: string,
  oldRowLabels: string[],
  newRowLabels: string[],
  oldColLabels: string[],
  newColLabels: string[],
) {
  const rowMap = buildLabelMap(oldRowLabels, newRowLabels);
  const colMap = buildLabelMap(oldColLabels, newColLabels);
  if (rowMap.size === 0 && colMap.size === 0) return;

  const orphanedRows = [...rowMap.entries()].filter(([, v]) => v === null).map(([k]) => k);
  const orphanedCols = [...colMap.entries()].filter(([, v]) => v === null).map(([k]) => k);
  const rowMoves = new Map([...rowMap.entries()].filter((e): e is [number, number] => e[1] !== null));
  const colMoves = new Map([...colMap.entries()].filter((e): e is [number, number] => e[1] !== null));

  await prisma.$transaction(async (tx) => {
    // Delete cells whose label was removed from the schedule
    if (orphanedRows.length > 0) {
      await tx.availabilityCell.deleteMany({ where: { eventId, rowIndex: { in: orphanedRows } } });
    }
    if (orphanedCols.length > 0) {
      await tx.availabilityCell.deleteMany({ where: { eventId, colIndex: { in: orphanedCols } } });
    }

    // Phase 1: move indices to temp negative space to avoid unique-constraint conflicts during reorder
    for (const [oldIdx] of rowMoves) {
      await tx.availabilityCell.updateMany({
        where: { eventId, rowIndex: oldIdx },
        data: { rowIndex: -(oldIdx + 1) },
      });
    }
    for (const [oldIdx] of colMoves) {
      await tx.availabilityCell.updateMany({
        where: { eventId, colIndex: oldIdx },
        data: { colIndex: -(oldIdx + 1) },
      });
    }

    // Phase 2: move from temp to final positions
    for (const [oldIdx, newIdx] of rowMoves) {
      await tx.availabilityCell.updateMany({
        where: { eventId, rowIndex: -(oldIdx + 1) },
        data: { rowIndex: newIdx },
      });
    }
    for (const [oldIdx, newIdx] of colMoves) {
      await tx.availabilityCell.updateMany({
        where: { eventId, colIndex: -(oldIdx + 1) },
        data: { colIndex: newIdx },
      });
    }
  });
}

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

  // Remap cell indices when labels were reordered or removed
  if (
    body.oldRowLabels !== undefined && Array.isArray(body.oldRowLabels) &&
    body.oldColLabels !== undefined && Array.isArray(body.oldColLabels) &&
    body.rowLabels !== undefined && body.colLabels !== undefined
  ) {
    await remapCells(
      eventId,
      body.oldRowLabels as string[],
      body.rowLabels as string[],
      body.oldColLabels as string[],
      body.colLabels as string[],
    );
  }

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
