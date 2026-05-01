import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createEditJwt } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      tableType,
      rowLabels,
      colLabels,
      rowMeta,
      colMeta,
      maxParticipants = 50,
      password,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "イベント名は必須です" } },
        { status: 400 }
      );
    }
    if (title.trim().length > 60) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "イベント名は60文字以内です" } },
        { status: 400 }
      );
    }
    if (!["timetable", "calendar", "custom", "date"].includes(tableType)) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "表形式が不正です" } },
        { status: 400 }
      );
    }
    if (!Array.isArray(rowLabels) || rowLabels.length === 0 || rowLabels.length > 30) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "縦軸ラベルは1〜30個必要です" } },
        { status: 400 }
      );
    }
    if (!Array.isArray(colLabels) || colLabels.length === 0 || colLabels.length > 30) {
      return Response.json(
        { error: { code: "INVALID_INPUT", message: "横軸ラベルは1〜30個必要です" } },
        { status: 400 }
      );
    }

    const participants = Math.max(1, Math.min(50, Number(maxParticipants) || 50));
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const editToken = uuidv4();

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        tableType,
        rowLabels: JSON.stringify(rowLabels),
        colLabels: JSON.stringify(colLabels),
        rowMeta: rowMeta ? JSON.stringify(rowMeta) : null,
        colMeta: colMeta ? JSON.stringify(colMeta) : null,
        maxParticipants: participants,
        passwordHash,
        editToken,
        status: "active",
      },
    });

    return Response.json(
      {
        event: {
          id: event.id,
          title: event.title,
          editToken: event.editToken,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("EVENT CREATE ERROR:", err);
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
