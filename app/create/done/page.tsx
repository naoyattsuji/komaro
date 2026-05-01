"use client";

import { use } from "react";
import Link from "next/link";
import { CheckCircle, ExternalLink, AlertTriangle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UrlDisplay } from "@/components/CopyButton";
import { getParticipantUrl, getEditUrl } from "@/lib/utils";

export default function CreateDonePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { id, token } = use(searchParams);

  if (!id || !token) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">無効なページです。</p>
        <Link href="/create" className="text-gray-700 underline mt-2 inline-block">
          イベントを作成する
        </Link>
      </div>
    );
  }

  const participantUrl = getParticipantUrl(id);
  const editUrl = getEditUrl(id, token);

  const shareText = encodeURIComponent(`日程調整に参加してください！\n${participantUrl}`);

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <CheckCircle size={52} className="text-gray-900 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">イベントを作成しました！</h1>
        <p className="text-gray-500 text-sm">URLをメンバーに共有して回答を集めましょう</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <UrlDisplay url={participantUrl} label="参加者向けURL（共有用）" />

        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-gray-500 shrink-0" />
            <p className="text-xs font-semibold text-gray-700">
              編集者向けURL — 必ず保管してください
            </p>
          </div>
          <UrlDisplay url={editUrl} />
          <p className="text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
            このURLを紛失するとイベントの編集・削除ができなくなります。メモアプリ等に保存してください。
          </p>
        </div>
      </div>

      {/* Share buttons */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-sm font-medium text-gray-700 mb-3">SNSで共有</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://line.me/R/msg/text/?${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#06C755] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ExternalLink size={14} />
            LINEで共有
          </a>
          <button
            onClick={async () => {
              if (typeof navigator !== "undefined" && navigator.share) {
                try {
                  await navigator.share({
                    title: "日程調整 — KOMARO",
                    text: "日程調整に参加してください！",
                    url: participantUrl,
                  });
                } catch { /* user cancelled */ }
              } else {
                // fallback: open native share sheet via URL scheme
                window.open(`https://twitter.com/intent/tweet?text=${shareText}`, "_blank");
              }
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gray-700 text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Share2 size={14} />
            その他
          </button>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <Link href={`/e/${id}`} className="flex-1">
          <Button className="w-full">イベントを確認する</Button>
        </Link>
        <Link href="/create" className="flex-1">
          <Button variant="secondary" className="w-full">別のイベントを作成</Button>
        </Link>
      </div>
    </div>
  );
}
