import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/comments">
) {
  const { eventId } = await ctx.params;

  const comments = await prisma.eventComment.findMany({
    where: { eventId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    comments: comments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/comments">
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
  const { authorName, body: commentBody } = body;

  if (!commentBody || typeof commentBody !== "string" || commentBody.trim().length === 0) {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "コメント本文は必須です" } },
      { status: 400 }
    );
  }
  if (commentBody.trim().length > 200) {
    return Response.json(
      { error: { code: "INVALID_INPUT", message: "コメントは200文字以内です" } },
      { status: 400 }
    );
  }

  const comment = await prisma.eventComment.create({
    data: {
      eventId,
      authorName: authorName?.trim() || null,
      body: commentBody.trim(),
    },
  });

  await prisma.event.update({
    where: { id: eventId },
    data: { lastUpdatedAt: new Date() },
  });

  return Response.json(
    {
      comment: {
        id: comment.id,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
