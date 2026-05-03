import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { rateLimit, getIP, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const rl = rateLimit({ key: `contact:${getIP(req)}`, limit: 5, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.resetAt);

  try {
    const { name, email, category, message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "メッセージは必須です" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "メッセージは2000文字以内で入力してください" }, { status: 400 });
    }

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      console.error("GMAIL_USER / GMAIL_APP_PASSWORD が未設定です");
      return NextResponse.json({ error: "メール送信の設定が完了していません" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"KOMARO お問い合わせ" <${user}>`,
      to: "naoyattsuji@gmail.com",
      replyTo: email,
      subject: `[KOMARO] ${category ?? "お問い合わせ"}`,
      text: [
        `【種類】${category ?? "未選択"}`,
        `【名前】${name || "（未入力）"}`,
        `【メール】${email}`,
        "",
        `【メッセージ】`,
        message,
      ].join("\n"),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("contact mail error:", e);
    return NextResponse.json({ error: "送信に失敗しました。時間をおいてお試しください" }, { status: 500 });
  }
}
