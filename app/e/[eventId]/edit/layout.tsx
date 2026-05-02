import type { Metadata } from "next";
import { prisma } from "@/lib/db";

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
    title: `「${title}」の編集 | KOMARO`,
    description: `「${title}」の編集ページです。変更後は必ず保存ボタンを押してください。`,
    openGraph: {
      title: `「${title}」の編集 | KOMARO`,
      description: `「${title}」の編集ページです。変更後は必ず保存ボタンを押してください。`,
    },
  };
}

export default function EditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
