"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/Toast";
import { Trash2, ArrowLeft, UserX, Copy } from "lucide-react";
import Link from "next/link";
import { KomaroLoader } from "@/components/KomaroLoader";

interface EventData {
  id: string;
  title: string;
  description?: string | null;
  tableType: string;
  rowLabels: string[];
  colLabels: string[];
  rowMeta?: { start?: string; end?: string }[] | null;
  colMeta?: unknown;
  maxParticipants: number;
  currentParticipantCount: number;
  status: string;
  hasPassword: boolean;
}

interface Participant {
  id: string;
  name: string;
}

export default function EditSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();

  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [jwt, setJwt] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [rowLabels, setRowLabels] = useState<string[]>([]);
  const [colLabels, setColLabels] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicating, setDuplicating] = useState(false);
  const [participantDeleteTarget, setParticipantDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingParticipant, setDeletingParticipant] = useState(false);

  useEffect(() => {
    const storedJwt = sessionStorage.getItem(`edit_jwt_${eventId}`);
    if (!storedJwt) {
      router.push(`/e/${eventId}/edit`);
      return;
    }
    setJwt(storedJwt);

    Promise.all([
      fetch(`/api/v1/events/${eventId}`).then((r) => r.json()),
      fetch(`/api/v1/events/${eventId}/participants`).then((r) => r.json()),
    ]).then(([eventData, participantsData]) => {
      const e = eventData.event;
      setEvent(e);
      setTitle(e.title);
      setDescription(e.description ?? "");
      setMaxParticipants(String(e.maxParticipants));
      setRowLabels(e.rowLabels);
      setColLabels(e.colLabels);
      setParticipants(participantsData.participants ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId, router]);

  const handleSave = async () => {
    if (!jwt || !event) return;
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "イベント名は必須です";
    const max = parseInt(maxParticipants);
    if (isNaN(max) || max < 1 || max > 50) errs.maxParticipants = "1〜50の数値を入力してください";
    if (max < event.currentParticipantCount) {
      errs.maxParticipants = `現在の参加者数（${event.currentParticipantCount}名）以上の値を設定してください`;
    }
    if (newPassword && (newPassword.length < 4 || newPassword.length > 20)) {
      errs.newPassword = "パスワードは4〜20文字で入力してください";
    }
    if (rowLabels.some((l) => !l.trim())) {
      errs.rowLabels = "縦軸ラベルに空の項目があります";
    }
    if (colLabels.some((l) => !l.trim())) {
      errs.colLabels = "横軸ラベルに空の項目があります";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        maxParticipants: max,
        rowLabels,
        rowMeta: event.rowMeta ?? null,
        colLabels,
        colMeta: event.colMeta ?? null,
      };
      if (newPassword) body.password = newPassword;

      const res = await fetch(`/api/v1/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error?.message ?? "エラーが発生しました", "error");
        return;
      }
      showToast("設定を更新しました");
      router.push(`/e/${eventId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteParticipant = async () => {
    if (!jwt || !participantDeleteTarget) return;
    setDeletingParticipant(true);
    try {
      const res = await fetch(`/api/v1/events/${eventId}/participants/${participantDeleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        setParticipants((prev) => prev.filter((p) => p.id !== participantDeleteTarget.id));
        showToast(`${participantDeleteTarget.name} の回答を削除しました`);
      } else {
        showToast("削除に失敗しました", "error");
      }
    } finally {
      setDeletingParticipant(false);
      setParticipantDeleteTarget(null);
    }
  };

  const handleDeleteEvent = async () => {
    if (!jwt) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        sessionStorage.removeItem(`edit_jwt_${eventId}`);
        showToast("イベントを削除しました");
        router.push("/");
      } else {
        showToast("削除に失敗しました", "error");
      }
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleDuplicate = async () => {
    if (!event) return;
    if (!confirm(`「${event.title}」を複製して新しいイベントを作成しますか？`)) return;
    setDuplicating(true);
    try {
      const res = await fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[コピー] ${event.title}`,
          description: event.description,
          tableType: event.tableType,
          rowLabels: event.rowLabels,
          colLabels: event.colLabels,
          rowMeta: event.rowMeta,
          colMeta: event.colMeta,
          maxParticipants: event.maxParticipants,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error?.message ?? "複製に失敗しました", "error");
        return;
      }
      const data = await res.json();
      const newEventId = data.event.id;
      const newEditToken = data.event.editToken;
      // Obtain a JWT for the new event via the edit-auth endpoint
      const authRes = await fetch(`/api/v1/events/${newEventId}/edit-auth?token=${encodeURIComponent(newEditToken)}`);
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.editJwt) {
          sessionStorage.setItem(`edit_jwt_${newEventId}`, authData.editJwt);
        }
      }
      showToast("イベントを複製しました");
      router.push(`/create/done?id=${newEventId}&token=${encodeURIComponent(newEditToken)}`);
    } finally {
      setDuplicating(false);
    }
  };

  if (loading) {
    return <KomaroLoader />;
  }

  if (!event) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">イベントが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Link href={`/e/${eventId}`} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-6">
        <ArrowLeft size={16} /> 集計に戻る
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mb-6">イベント設定の編集</h1>

      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">基本情報</h2>
          <Input
            label="イベント名 *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            error={errors.title}
          />
          <Textarea
            label="イベントの詳細（任意）"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <Input
            label="参加者上限"
            type="number"
            inputMode="numeric"
            min={event.currentParticipantCount || 1}
            max={50}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            error={errors.maxParticipants}
            hint={`現在 ${event.currentParticipantCount}名が回答済み`}
          />
          <Input
            label="新しい編集パスワード（変更する場合のみ）"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="4〜20文字"
            maxLength={20}
            error={errors.newPassword}
          />
        </div>

        {/* Matrix labels */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800 text-sm mb-1">マトリクス構造</h2>
            <p className="text-xs text-gray-400">ラベルの表示名のみ変更されます。既存の回答データには影響しません。</p>
          </div>
          {errors.rowLabels && (
            <p className="text-xs text-red-500">{errors.rowLabels}</p>
          )}
          {errors.colLabels && (
            <p className="text-xs text-red-500">{errors.colLabels}</p>
          )}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">縦軸ラベル（{rowLabels.length}項目）</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {rowLabels.map((label, i) => (
                <input
                  key={i}
                  type="text"
                  value={label}
                  onChange={(e) => {
                    const next = [...rowLabels];
                    next[i] = e.target.value;
                    setRowLabels(next);
                  }}
                  maxLength={50}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">横軸ラベル（{colLabels.length}項目）</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {colLabels.map((label, i) => (
                <input
                  key={i}
                  type="text"
                  value={label}
                  onChange={(e) => {
                    const next = [...colLabels];
                    next[i] = e.target.value;
                    setColLabels(next);
                  }}
                  maxLength={50}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">
            参加者一覧（{participants.length}名）
          </h2>
          {participants.length === 0 ? (
            <p className="text-sm text-gray-400">まだ回答者がいません</p>
          ) : (
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{p.name}</span>
                  <button
                    onClick={() => setParticipantDeleteTarget({ id: p.id, name: p.name })}
                    className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                    aria-label={`${p.name}の回答を削除`}
                  >
                    <UserX size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button className="w-full" size="lg" onClick={handleSave} loading={saving}>
          設定を保存する
        </Button>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-2">このイベントを複製</h2>
          <p className="text-xs text-gray-500 mb-3">
            同じ設定（タイトル・表の形式・ラベル・上限）で新しいイベントを作成します。参加者の回答はコピーされません。
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleDuplicate}
            loading={duplicating}
          >
            <Copy size={16} className="mr-2" />
            このイベントを複製する
          </Button>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500 mb-3 font-medium">危険な操作</p>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 size={16} className="mr-2" />
            イベントを削除する
          </Button>
        </div>
      </div>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="イベントを削除しますか？"
      >
        <p className="text-sm text-gray-600 mb-4">
          「{event.title}」を削除すると、すべての回答・コメントが失われます。
          この操作は取り消せません。
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteModal(false)}>
            キャンセル
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDeleteEvent} loading={deleting}>
            削除する
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!participantDeleteTarget}
        onClose={() => setParticipantDeleteTarget(null)}
        title="回答を削除しますか？"
      >
        <p className="text-sm text-gray-600 mb-4">
          「{participantDeleteTarget?.name}」の回答を削除します。この操作は取り消せません。
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setParticipantDeleteTarget(null)}>
            キャンセル
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDeleteParticipant} loading={deletingParticipant}>
            削除する
          </Button>
        </div>
      </Modal>
    </div>
  );
}
