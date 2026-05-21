"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { CheckCircle, AlertTriangle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { UrlDisplay } from "@/components/CopyButton";
import { FadeInSection } from "@/components/FadeInSection";
import { showToast } from "@/components/ui/Toast";
import { getParticipantUrl, getEditUrl } from "@/lib/utils";
import { trackEvent } from "@/lib/ga";

export default function CreateDonePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { id, token } = use(searchParams);

  useEffect(() => {
    if (id) trackEvent("event_created", { event_id: id });
  }, [id]);

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

  const lineShareUrl = `https://line.me/R/msg/text/?${encodeURIComponent(`【コマを使った日程調整】みんなの空き時間をコマの色で確認してね！\n空いてるコマをタップするだけ👇\n${participantUrl}`)}`;

  return (
    <div className="max-w-xl mx-auto px-4 py-10">

      {/* ── Hero: icon + title ──────────────────────────────── */}
      <div className="text-center mb-8">
        <div
          className="anim-hero-scale inline-flex"
          style={{ animationDelay: "0ms" }}
        >
          <CheckCircle size={52} className="text-gray-900 mx-auto mb-3" />
        </div>
        <h1
          className="anim-hero text-2xl font-bold text-gray-900 mb-2"
          style={{ animationDelay: "80ms" }}
        >
          イベントを作成しました！
        </h1>
        <p
          className="anim-hero text-gray-500 text-sm"
          style={{ animationDelay: "180ms" }}
        >
          URLをメンバーに共有して回答を集めましょう
        </p>
      </div>

      {/* ── URL cards ───────────────────────────────────────── */}
      <FadeInSection delay={220}>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <UrlDisplay url={participantUrl} label="参加者向けURL（共有用）" />

          <div className="border-t border-gray-100 pt-4">
            <UrlDisplay url={editUrl} label="編集者向けURL（必ず保管）" />
            <div className="flex items-start gap-1.5 mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2">
              <AlertTriangle size={13} className="text-gray-500 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600">
                このURLを紛失するとイベントの編集・削除ができなくなります。メモアプリ等に保存してください。
              </p>
            </div>
          </div>
        </div>
      </FadeInSection>

      {/* ── Share buttons ───────────────────────────────────── */}
      <FadeInSection delay={320}>
        <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-medium text-gray-700 mb-0.5">メンバーに共有する</p>
          <p className="text-xs text-gray-400 mb-3">LINEで送るのが一番かんたんでおすすめです</p>
          <a
            href={lineShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("line_share_click", { source: "create_done" })}
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl bg-[#06C755] text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
            LINEでメンバーに送る
          </a>
          <button
            onClick={async () => {
              trackEvent("share_click", { source: "create_done", method: "native_or_copy" });
              if (typeof navigator !== "undefined" && navigator.share) {
                try {
                  await navigator.share({
                    title: "日程調整 — KOMARO",
                    text: "日程調整への回答をお願いします！",
                    url: participantUrl,
                  });
                } catch { /* user cancelled */ }
              } else {
                try {
                  await navigator.clipboard.writeText(participantUrl);
                } catch {
                  const textarea = document.createElement("textarea");
                  textarea.value = participantUrl;
                  textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
                  document.body.appendChild(textarea);
                  textarea.focus();
                  textarea.select();
                  document.execCommand("copy");
                  document.body.removeChild(textarea);
                }
                showToast("共有リンクをコピーしました");
              }
            }}
            className="flex items-center justify-center gap-1.5 w-full mt-2 py-2 rounded-xl text-gray-400 text-xs hover:text-gray-600 transition-colors"
          >
            <Share2 size={12} />
            その他の方法で送る
          </button>
        </div>
      </FadeInSection>

      {/* ── Action buttons ──────────────────────────────────── */}
      <FadeInSection delay={400}>
        <div className="mt-5 flex gap-3 mb-safe">
          <Link href={`/e/${id}`} className="flex-1">
            <Button className="w-full">イベントを確認する</Button>
          </Link>
          <Link href="/create" className="flex-1">
            <Button variant="secondary" className="w-full">別のイベントを作成</Button>
          </Link>
        </div>
      </FadeInSection>

    </div>
  );
}
