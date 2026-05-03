import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createEditJwt, verifyEditJwt } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

const LOCK_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/edit-auth">
) {
  const { eventId } = await ctx.params;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return Response.json({ valid: false }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { editToken: true },
  });

  if (!event || event.editToken !== token) {
    return Response.json({ valid: false }, { status: 401 });
  }

  const jwt = await createEditJwt(eventId);
  return Response.json({ valid: true, editJwt: jwt });
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/v1/events/[eventId]/edit-auth">
) {
  const rl = rateLimit({ key: `edit-auth:${getIP(req)}`, limit: 20, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  const { eventId } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  const lockRecord = await prisma.loginAttempt.findFirst({
    where: { eventId, ipAddress: ip },
  });

  if (lockRecord?.lockedAt) {
    const unlockAt = new Date(lockRecord.lockedAt.getTime() + LOCK_MINUTES * 60000);
    if (new Date() < unlockAt) {
      const remaining = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);
      return Response.json(
        { error: { code: "BRUTE_FORCE_LOCKED", message: `ロックアウト中です。${remaining}分後に再試行してください` } },
        { status: 429 }
      );
    } else {
      await prisma.loginAttempt.update({
        where: { id: lockRecord.id },
        data: { attempts: 0, lockedAt: null },
      });
    }
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { passwordHash: true },
  });

  if (!event) {
    return Response.json(
      { error: { code: "EVENT_NOT_FOUND", message: "イベントが見つかりません" } },
      { status: 404 }
    );
  }
  if (!event.passwordHash) {
    return Response.json(
      { error: { code: "NO_PASSWORD", message: "このイベントにはパスワードが設定されていません" } },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { password } = body;

  const valid = await bcrypt.compare(password ?? "", event.passwordHash);

  if (!valid) {
    const currentAttempts = (lockRecord?.attempts ?? 0) + 1;
    const shouldLock = currentAttempts >= LOCK_ATTEMPTS;

    await prisma.loginAttempt.upsert({
      where: { eventId_ipAddress: { eventId, ipAddress: ip } },
      create: { eventId, ipAddress: ip, attempts: currentAttempts, lockedAt: shouldLock ? new Date() : null },
      update: { attempts: currentAttempts, lockedAt: shouldLock ? new Date() : null },
    });

    const remaining = LOCK_ATTEMPTS - currentAttempts;
    return Response.json(
      {
        error: {
          code: "INVALID_PASSWORD",
          message: shouldLock
            ? `パスワードが正しくありません。${LOCK_MINUTES}分間ロックされました`
            : `パスワードが正しくありません（残り${remaining}回）`,
        },
      },
      { status: 401 }
    );
  }

  if (lockRecord) {
    await prisma.loginAttempt.update({
      where: { id: lockRecord.id },
      data: { attempts: 0, lockedAt: null },
    });
  }

  const jwt = await createEditJwt(eventId);
  return Response.json({ editJwt: jwt });
}
