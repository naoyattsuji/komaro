import { notFound } from "next/navigation";
import { Suspense } from "react";
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
    select: { title: true, description: true },
  });
  const title = event?.title ?? "日程調整";
  const defaultDesc = `「${title}」の参加可能な日程を登録してください。登録不要・URLを開くだけで回答できます。`;
  const description = event?.description?.trim() || defaultDesc;
  return {
    title: `${title} | KOMARO`,
    description,
    openGraph: {
      title: `${title} | KOMARO`,
      description,
      // opengraph-image.tsx が動的に生成するため images は指定しない
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | KOMARO`,
      description,
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
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" /></div>}>
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
    </Suspense>
  );
}
