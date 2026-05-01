import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyEditJwt } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/comments/[commentId]">
) {
  const { eventId, commentId } = await ctx.params;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const payload = token ? await verifyEditJwt(token) : null;
  if (!payload || payload.eventId !== eventId) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "編集権限がありません" } },
      { status: 401 }
    );
  }

  const comment = await prisma.eventComment.findFirst({
    where: { id: commentId, eventId, deletedAt: null },
  });
  if (!comment) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "コメントが見つかりません" } },
      { status: 404 }
    );
  }

  await prisma.eventComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return new Response(null, { status: 204 });
}
