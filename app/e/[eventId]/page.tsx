import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { EventClient } from "./EventClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
    select: { title: true },
  });
  const title = event?.title ?? "日程調整";
  return {
    title: `「${title}」の日程調整 | KOMARO`,
    description: `「${title}」の参加可能な日程を登録してください。登録不要・URLを開くだけで回答できます。`,
    openGraph: {
      title: `「${title}」の日程調整 | KOMARO`,
      description: `「${title}」の参加可能な日程を登録してください。登録不要・URLを開くだけで回答できます。`,
      // opengraph-image.tsx が動的に生成するため images は指定しない
    },
    twitter: {
      card: "summary_large_image",
      title: `「${title}」の日程調整 | KOMARO`,
      description: `「${title}」の参加可能な日程を登録してください。登録不要・URLを開くだけで回答できます。`,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, deletedAt: null },
  });

  if (!event) notFound();

  const participantCount = await prisma.participant.count({
    where: { eventId },
  });

  return (
    <EventClient
      eventId={eventId}
      initialEvent={{
        id: event.id,
        title: event.title,
        description: event.description,
        tableType: event.tableType,
        rowLabels: JSON.parse(event.rowLabels),
        colLabels: JSON.parse(event.colLabels),
        rowMeta: event.rowMeta ? JSON.parse(event.rowMeta) : undefined,
        maxParticipants: event.maxParticipants,
        currentParticipantCount: participantCount,
        status: event.status,
      }}
    />
  );
}
