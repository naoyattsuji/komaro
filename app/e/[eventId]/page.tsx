import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EventClient } from "./EventClient";

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
