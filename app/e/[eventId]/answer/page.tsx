"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AvailabilityTable } from "@/components/AvailabilityTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/Toast";
import { ArrowLeft, CheckSquare, Square } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { FadeInSection } from "@/components/FadeInSection";
import { CalendarImageReader } from "@/components/CalendarImageReader";
import { VoiceInputReader } from "@/components/VoiceInputReader";

interface EventInfo {
  id: string;
  title: string;
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

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateParticipantId, setDuplicateParticipantId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/events/${eventId}`)
      .then((r) => r.json())
      .then((d) => { setEvent(d.event); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [eventId]);

  const toggleCell = useCallback((r: number, c: number) => {
    const key = `${r}-${c}`;
    setSelectedCells((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
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
      const res = await fetch(`/api/v1/events/${eventId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          cells: getCellsArray(),
          overwrite,
        }),
      });
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
      showToast("回答を送信しました！");
      router.push(`/e/${eventId}`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
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

  if (event.currentParticipantCount >= event.maxParticipants) {
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
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div
        className="anim-hero flex items-center gap-2 mb-4"
        style={{ animationDelay: "0ms" }}
      >
        <Link href={`/e/${eventId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{event.title}</h1>
          <p className="text-xs text-gray-500">参加できるコマをタップして選択してください</p>
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
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          maxLength={100}
          error={nameError}
          hint={`${name.length}/100文字`}
        />
      </div>

      {/* 自動入力ボタン群 */}
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

      {/* Controls */}
      <div
        className="anim-hero flex items-center gap-2 mb-3 flex-wrap"
        style={{ animationDelay: "180ms" }}
      >
        <span className="text-sm text-gray-600 font-medium">
          {selectedCells.size}コマ選択中
        </span>
        <button
          onClick={selectAll}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-2.5 py-1"
        >
          <CheckSquare size={12} /> 全選択
        </button>
        <button
          onClick={deselectAll}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1"
        >
          <Square size={12} /> 全解除
        </button>
      </div>

      {/* Table */}
      <FadeInSection delay={60}>
        <AvailabilityTable
          rowLabels={event.rowLabels}
          colLabels={event.colLabels}
          rowMeta={event.rowMeta}
          mode="edit"
          selectedCells={selectedCells}
          onCellToggle={toggleCell}
        />
      </FadeInSection>

      {/* Submit — sticky keeps it visible while scrolling table, but won't overlap footer */}
      <div className="sticky bottom-4 z-[60] mt-4">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          loading={submitting}
        >
          この内容で送信する（{selectedCells.size}コマ選択）
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
