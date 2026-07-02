"use client";

import { use, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AvailabilityTable } from "@/components/AvailabilityTable";
import { DateCalendarAnswer } from "@/components/DateCalendarAnswer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/Toast";
import { ArrowLeft, CheckSquare, Square, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { FadeInSection } from "@/components/FadeInSection";
import { KOMAROLoader } from "@/components/KOMAROLoader";
import { trackEvent } from "@/lib/ga";
import { rememberRecentEvent } from "@/lib/recentEvents";
// import { CalendarImageReader } from "@/components/CalendarImageReader";
// import { VoiceInputReader } from "@/components/VoiceInputReader";

interface EventInfo {
  id: string;
  title: string;
  tableType: string;
  rowLabels: string[];
  colLabels: string[];
  rowMeta?: { start?: string; end?: string }[];
  maxParticipants: number;
  currentParticipantCount: number;
  status: string;
  hasPassword: boolean;
}

export default function AnswerPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const editParticipantId = searchParams.get("edit");
  const isEditMode = !!editParticipantId;

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [, setDuplicateParticipantId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/events/${eventId}`)
      .then((r) => r.json())
      .then((d) => { setEvent(d.event); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [eventId]);

  useEffect(() => {
    if (!editParticipantId) return;
    fetch(`/api/v1/events/${eventId}/participants/${editParticipantId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.participant) {
          setName(d.participant.name);
          setSelectedCells(new Set(
            d.participant.cells.map((c: { rowIndex: number; colIndex: number }) => `${c.rowIndex}-${c.colIndex}`)
          ));
        }
      });
  }, [eventId, editParticipantId]);

  const toggleCell = useCallback((r: number, c: number) => {
    const key = `${r}-${c}`;
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAll = () => {
    if (!event) return;
    const all = new Set<string>();
    event.rowLabels.forEach((_, r) =>
      event.colLabels.forEach((_, c) => all.add(`${r}-${c}`))
    );
    setSelectedCells(all);
  };

  const deselectAll = () => setSelectedCells(new Set());

  const getCellsArray = () =>
    Array.from(selectedCells).map((key) => {
      const [r, c] = key.split("-").map(Number);
      return { rowIndex: r, colIndex: c };
    });

  const doSubmit = async (overwrite = false) => {
    setSubmitting(true);
    try {
      let res: Response;
      if (isEditMode && editParticipantId) {
        res = await fetch(`/api/v1/events/${eventId}/participants/${editParticipantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), cells: getCellsArray() }),
        });
      } else {
        res = await fetch(`/api/v1/events/${eventId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            cells: getCellsArray(),
            overwrite,
          }),
        });
      }
      const data = await res.json();

      if (res.status === 409 && data.error?.code === "DUPLICATE_PARTICIPANT_NAME") {
        setDuplicateParticipantId(data.error.participantId);
        setShowDuplicateModal(true);
        return;
      }
      if (!res.ok) {
        showToast(data.error?.message ?? "エラーが発生しました", "error");
        return;
      }
      showToast(isEditMode ? "回答を修正しました！" : "回答を送信しました！");
      rememberRecentEvent({ id: eventId, title: event?.title, kind: "joined" });
      if (isEditMode) {
        router.push(`/e/${eventId}`);
      } else {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) { setNameError("名前を入力してください"); return; }
    if (name.trim().length > 100) { setNameError("100文字以内で入力してください"); return; }
    setNameError("");
    doSubmit(false);
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="anim-hero-scale inline-flex mb-4" style={{ animationDelay: "0ms" }}>
          <CheckCircle size={52} className="text-gray-900 mx-auto" />
        </div>
        <h1 className="anim-hero text-2xl font-bold text-gray-900 mb-2" style={{ animationDelay: "80ms" }}>
          回答を送信しました！
        </h1>
        <p className="anim-hero text-sm text-gray-500 mb-8" style={{ animationDelay: "160ms" }}>
          みんなの集計結果を確認しましょう
        </p>

        <FadeInSection delay={240}>
          <Link
            href={`/e/${eventId}`}
            className="inline-flex items-center gap-2 bg-gray-900 text-white font-medium px-6 py-3 rounded-md hover:bg-gray-700 transition-colors text-sm mb-8"
          >
            集計を見る
            <ArrowRight size={16} />
          </Link>
        </FadeInSection>

        <FadeInSection delay={360}>
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-5 text-left">
            <p className="text-sm font-semibold text-gray-800 mb-1">
              コマを使ってあなたもイベントを作りませんか？
            </p>
            <p className="text-xs text-gray-500 mb-4">
              登録不要・URLを送るだけで日程調整ができます
            </p>
            <Link
              href="/create"
              onClick={() => trackEvent("create_from_answer_cta", { source_event_id: eventId })}
              className="flex items-center justify-center gap-2 bg-gray-900 text-white font-medium px-5 py-2.5 rounded-md hover:bg-gray-700 transition-colors text-sm w-full"
            >
              イベントを作成する →
            </Link>
          </div>
        </FadeInSection>
      </div>
    );
  }

  if (loading) {
    return <KOMAROLoader />;
  }

  if (!event) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">イベントが見つかりません</p>
        <Link href="/" className="text-gray-700 underline mt-2 inline-block">トップへ戻る</Link>
      </div>
    );
  }

  if (event.status === "expired") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-700 font-medium">このイベントは期限切れです</p>
        <Link href={`/e/${eventId}`} className="text-gray-700 underline mt-2 inline-block">集計を見る</Link>
      </div>
    );
  }

  if (!isEditMode && event.currentParticipantCount >= event.maxParticipants) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-700 font-medium">
          参加者上限（{event.maxParticipants}名）に達しています
        </p>
        <Link href={`/e/${eventId}`} className="text-gray-700 underline mt-2 inline-block">集計を見る</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
      <div
        className="anim-hero flex items-center gap-2 mb-4"
        style={{ animationDelay: "0ms" }}
      >
        <Link href={`/e/${eventId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{event.title}</h1>
          <p className="text-xs text-gray-500">
            {isEditMode
              ? "回答を修正してください"
              : event.tableType === "date"
              ? "参加できる日付をタップして選択してください"
              : "参加できるコマをタップして選択してください"}
          </p>
        </div>
      </div>

      {/* Name input */}
      <div
        className="anim-hero bg-white rounded-xl border border-gray-200 p-4 mb-4"
        style={{ animationDelay: "100ms" }}
      >
        <Input
          label="あなたの名前 *"
          placeholder="例: 田中太郎"
          value={name}
          onChange={(e) => { if (!isEditMode) { setName(e.target.value); setNameError(""); } }}
          maxLength={100}
          error={nameError}
          hint={isEditMode ? "修正モードでは名前を変更できません" : `${name.length}/100文字`}
          disabled={isEditMode}
        />
      </div>

      {/* 自動入力ボタン群（精度改善まで非表示）
      <div className="anim-hero flex flex-wrap gap-2 mb-2" style={{ animationDelay: "160ms" }}>
        <CalendarImageReader
          rowLabels={event.rowLabels}
          colLabels={event.colLabels}
          onDetected={(cells) => setSelectedCells(cells)}
        />
        <VoiceInputReader
          rowLabels={event.rowLabels}
          colLabels={event.colLabels}
          onDetected={(cells) => setSelectedCells(cells)}
        />
      </div>
      */}

      {/* Controls */}
      <div
        className="anim-hero flex flex-wrap items-center justify-between gap-2 mb-3"
        style={{ animationDelay: "180ms" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-600 font-medium shrink-0">
            {selectedCells.size}{event.tableType === "date" ? "日" : "コマ"}選択中
          </span>
          {event.tableType !== "date" && (
            <span className="text-xs text-gray-400 hidden sm:block truncate">ドラッグで複数まとめて選択できます</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5 shrink-0">
          <button
            onClick={selectAll}
            className="flex items-center justify-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5"
          >
            <CheckSquare size={12} /> 全選択
          </button>
          <button
            onClick={deselectAll}
            className="flex items-center justify-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5"
          >
            <Square size={12} /> 全解除
          </button>
        </div>
      </div>

      {/* Table / Calendar */}
      <FadeInSection delay={60}>
        {event.tableType === "date" ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <DateCalendarAnswer
              rowLabels={event.rowLabels}
              selectedCells={selectedCells}
              onToggle={(rowIndex) => toggleCell(rowIndex, 0)}
            />
          </div>
        ) : (
          <AvailabilityTable
            rowLabels={event.rowLabels}
            colLabels={event.colLabels}
            rowMeta={event.rowMeta}
            mode="edit"
            selectedCells={selectedCells}
            onCellToggle={toggleCell}
          />
        )}
      </FadeInSection>

      {/* Submit — sticky keeps it visible while scrolling table */}
      <div className="sticky z-[60] mt-4 pb-safe" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          loading={submitting}
        >
          {isEditMode ? "この内容で修正する" : "この内容で送信する"}
        </Button>
      </div>

      {/* Duplicate name modal */}
      <Modal
        open={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title="同名の参加者が存在します"
      >
        <p className="text-sm text-gray-600 mb-4">
          「{name}」という参加者がすでに回答しています。
          回答を上書きしますか？それとも別の名前で登録しますか？
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setShowDuplicateModal(false)}
          >
            別の名前を使う
          </Button>
          <Button
            className="flex-1"
            loading={submitting}
            onClick={() => { setShowDuplicateModal(false); doSubmit(true); }}
          >
            上書きする
          </Button>
        </div>
      </Modal>
    </div>
  );
}
