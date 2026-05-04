import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const cleanupSecret = process.env.CLEANUP_SECRET;

  // If CLEANUP_SECRET is not set, skip (production-only feature)
  if (!cleanupSecret) {
    return Response.json(
      { message: "CLEANUP_SECRET not set, skipping cleanup" },
      { status: 200 }
    );
  }

  // Verify authorization header
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || token !== cleanupSecret) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "認証に失敗しました" } },
      { status: 401 }
    );
  }

  // Delete events that have been soft-deleted (deletedAt) 30+ days ago
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await prisma.event.deleteMany({
    where: {
      deletedAt: {
        not: null,
        lte: thirtyDaysAgo,
      },
    },
  });

  return Response.json({
    deleted: result.count,
    message: `${result.count}件のイベントを物理削除しました`,
  });
}
