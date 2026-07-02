"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AvailabilityTable } from "@/components/AvailabilityTable";
import { DateCalendarSummary } from "@/components/DateCalendarSummary";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { showToast } from "@/components/ui/Toast";
import { Users, MessageSquare, Send, Edit3, CalendarPlus, Download, Trash2 } from "lucide-react";
import {
  formatDateTime,
  parseColLabelToDate,
  buildDateRange,
  buildShortCalendarUrl,
  ensureWeekday,
  CalendarEventParams,
} from "@/lib/utils";
import { CalendarExport } from "@/components/CalendarExport";
import { CopyButton } from "@/components/CopyButton";
import { getParticipantUrl } from "@/lib/utils";
import { FadeInSection } from "@/components/FadeInSection";
import { KOMAROLoader } from "@/components/KOMAROLoader";
import { trackEvent } from "@/lib/ga";
import { rememberRecentEvent } from "@/lib/recentEvents";

interface EventClientProps {
  eventId: string;
  initialEvent: {
    id: string;
    title: string;
    description?: string | null;
    tableType: string;
    rowLabels: string[];
    colLabels: string[];
    rowMeta?: { start?: string; end?: string }[];
    maxParticipants: number;
    currentParticipantCount: number;
    status: string;
  };
}

interface CellSummary {
  rowIndex: number;
  colIndex: number;
  count: number;
  isMax: boolean;
}

interface Participant {
  id: string;
  name: string;
  cells: { rowIndex: number; colIndex: number }[];
}

interface Comment {
  id: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

function UnavailableList({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
      >
        参加不可 ({names.length}名)
        <span className="text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-2 mt-2">
          {names.map((name) => (
            <span key={name} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-sm rounded-full">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function EventClient({ eventId, initialEvent }: EventClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [event] = useState(initialEvent);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [cellParticipants, setCellParticipants] = useState<{ available: string[]; unavailable: string[] } | null>(null);
  const [filterNames, setFilterNames] = useState<Set<string>>(() => {
    // Initialize from URL params if present
    const filterParam = searchParams.get("filter");
    if (filterParam) {
      return new Set(filterParam.split(",").map((n) => decodeURIComponent(n)).filter(Boolean));
    }
    return new Set();
  });
  const [filterInitializedFromUrl, setFilterInitializedFromUrl] = useState(() => {
    return !!searchParams.get("filter");
  });
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);
  const [longPressTarget, setLongPressTarget] = useState<{ id: string; name: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingParticipant, setDeletingParticipant] = useState(false);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [commentAuthor, setCommentAuthor] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("komaro_comment_author") ?? "";
  });
  const [commentBody, setCommentBody] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const isExpired = event.status === "expired";

  const fetchSummary = useCallback(async () => {
    const res = await fetch(`/api/v1/events/${eventId}/summary`);
    if (!res.ok) { setSummaryLoaded(true); return; }
    const data = await res.json();
    setParticipants(data.participants);
    setSummaryLoaded(true);
  }, [eventId]);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/v1/events/${eventId}/comments`);
    if (!res.ok) return;
    const data = await res.json();
    setComments(data.comments);
  }, [eventId]);

  useEffect(() => {
    trackEvent("event_view", { event_id: eventId });
    rememberRecentEvent({ id: eventId, title: event.title, kind: "viewed" });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary();
    fetchComments();
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, [fetchSummary, fetchComments, event.title, eventId]);

  // Auto-select all participants (including newly joined ones), unless URL filter was set
  useEffect(() => {
    if (filterInitializedFromUrl) {
      // Only add newly joined participants that aren't filtered out yet, keep existing filter
      // Once loaded, stop treating filter as URL-initialized so new participants get added
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilterInitializedFromUrl(false);
      return;
    }
    setFilterNames((prev) => {
      const next = new Set(prev);
      participants.forEach((p) => next.add(p.name));
      return next;
    });
  }, [participants]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync filter state to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filterNames.size > 0 && participants.length > 0) {
      const allNames = new Set(participants.map((p) => p.name));
      const isAllSelected = participants.every((p) => filterNames.has(p.name));
      if (isAllSelected) {
        params.delete("filter");
      } else {
        const filtered = Array.from(filterNames).filter((n) => allNames.has(n));
        if (filtered.length > 0) {
          params.set("filter", filtered.map((n) => encodeURIComponent(n)).join(","));
        } else {
          params.delete("filter");
        }
      }
    } else {
      params.delete("filter");
    }
    const newSearch = params.toString();
    const currentSearch = searchParams.toString();
    if (newSearch !== currentSearch) {
      router.replace(`/e/${eventId}${newSearch ? `?${newSearch}` : ""}`, { scroll: false });
    }
  }, [filterNames, participants]); // eslint-disable-line react-hooks/exhaustive-deps

  // When all deselected, auto-reset to all after 2s
  useEffect(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (filterNames.size === 0 && participants.length > 0) {
      resetTimerRef.current = setTimeout(() => {
        setFilterNames(new Set(participants.map((p) => p.name)));
      }, 2000);
    }
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [filterNames, participants]);

  const handleCellClick = async (r: number, c: number) => {
    setSelectedCell({ r, c });
    setCellParticipants(null);
    const res = await fetch(`/api/v1/events/${eventId}/cells/${r}/${c}`);
    if (res.ok) setCellParticipants(await res.json());
  };

  const toggleFilter = (name: string) => {
    setFilterNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleParticipantPointerDown = (id: string, name: string) => {
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setLongPressTarget({ id, name });
    }, 600);
  };

  const handleParticipantPointerUp = (name: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!didLongPressRef.current) {
      toggleFilter(name);
    }
    didLongPressRef.current = false;
  };

  const handleParticipantPointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleDeleteParticipant = async () => {
    if (!longPressTarget) return;
    setDeletingParticipant(true);
    try {
      const res = await fetch(
        `/api/v1/events/${eventId}/participants/${longPressTarget.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setFilterNames((prev) => {
          const next = new Set(prev);
          next.delete(longPressTarget.name);
          return next;
        });
        showToast(`${longPressTarget.name} の回答を削除しました`);
        fetchSummary();
      } else {
        showToast("削除に失敗しました", "error");
      }
    } finally {
      setDeletingParticipant(false);
      setShowDeleteConfirm(false);
      setLongPressTarget(null);
    }
  };

  // When filter active: compute per-cell counts for only selected participants
  const getFilteredDisplay = (): { cells: CellSummary[]; maxCount: number } => {
    if (filterNames.size === 0) return { cells: [], maxCount: 0 };
    const selected = participants.filter((p) => filterNames.has(p.name));
    const countMap = new Map<string, number>();
    selected.forEach((p) =>
      p.cells.forEach((cell) => {
        const key = `${cell.rowIndex}-${cell.colIndex}`;
        countMap.set(key, (countMap.get(key) ?? 0) + 1);
      })
    );
    let maxCount = 0;
    const cells: CellSummary[] = [];
    countMap.forEach((count, key) => {
      if (count > maxCount) maxCount = count;
      const [rowIndex, colIndex] = key.split("-").map(Number);
      cells.push({ rowIndex, colIndex, count, isMax: false });
    });
    cells.forEach((cell) => { cell.isMax = cell.count === maxCount; });
    return { cells, maxCount };
  };

  const { cells: displayCells, maxCount: displayMaxCount } = getFilteredDisplay();



  const downloadCSV = () => {
    const selected = participants.filter((p) => filterNames.has(p.name));
    const displayParticipants = selected.length > 0 ? selected : participants;

    // Build header row: "参加者名" + col labels (row × col)
    const headers: string[] = ["参加者名"];
    event.rowLabels.forEach((row) => {
      event.colLabels.forEach((col) => {
        headers.push(`${col} ${row}`);
      });
    });

    const rows: string[][] = [headers];

    displayParticipants.forEach((p) => {
      const availSet = new Set(p.cells.map((c) => `${c.rowIndex}-${c.colIndex}`));
      const row: string[] = [p.name];
      event.rowLabels.forEach((_, ri) => {
        event.colLabels.forEach((_, ci) => {
          row.push(availSet.has(`${ri}-${ci}`) ? "○" : "×");
        });
      });
      rows.push(row);
    });

    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const bom = "﻿"; // UTF-8 BOM for Excel
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title}_回答一覧.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitComment = async () => {
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/v1/events/${eventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: commentAuthor || undefined, body: commentBody }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setCommentBody("");
        showToast("コメントを投稿しました");
      } else {
        const data = await res.json();
        showToast(data.error?.message ?? "エラーが発生しました", "error");
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-4">
        <div
          className="anim-hero"
          style={{ animationDelay: "0ms" }}
        >
          <Badge variant={isExpired ? "expired" : "active"} className="mb-2">
            {isExpired ? "期限切れ" : "受付中"}
          </Badge>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{event.title}</h1>
        </div>
        {event.description && (
          <p
            className="anim-hero mt-2 text-sm text-gray-600"
            style={{ animationDelay: "80ms" }}
          >
            {event.description}
          </p>
        )}
        <div
          className="anim-hero flex items-center gap-4 mt-2 text-sm text-gray-500"
          style={{ animationDelay: "120ms" }}
        >
          <span className="flex items-center gap-1">
            <Users size={14} />
            {event.currentParticipantCount} / {event.maxParticipants}名
          </span>
        </div>

        {isExpired && (
          <div className="mt-3 bg-gray-100 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
            このイベントは期限切れです。閲覧のみ可能です。
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isExpired && (
        <div
          className="anim-hero mb-5"
          style={{ animationDelay: "200ms" }}
        >
          {/* Desktop: horizontal inline row */}
          <div className="hidden sm:flex items-center gap-3">
            <Link href={`/e/${eventId}/answer`}>
              <Button size="lg" className="gap-2 shrink-0">
                <Edit3 size={16} />
                回答する
              </Button>
            </Link>
            <div className="h-8 w-px bg-gray-200 mx-1 shrink-0" />
            <p className="text-sm text-gray-500 shrink-0">参加者に共有：</p>
            <a
              href={`https://line.me/R/msg/text/?${encodeURIComponent(`「${event.title}」の日程を確認してください →\n空いてるコマをタップするだけ！\n${getParticipantUrl(eventId)}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("line_share_click", { source: "event_page" })}
              className="flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-[#06C755] hover:bg-[#05a847] transition-colors rounded-lg px-4 py-2 shrink-0"
            >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                LINEで共有
              </a>
            <CopyButton
              text={getParticipantUrl(eventId)}
              label="リンクをコピー"
              className="shrink-0 justify-center bg-white border border-gray-300 text-gray-800 hover:bg-gray-50"
            />
          </div>

          {/* Mobile: stacked with card */}
          <div className="flex flex-col gap-2 sm:hidden">
            <Link href={`/e/${eventId}/answer`}>
              <Button size="lg" className="w-full gap-2">
                <Edit3 size={16} />
                回答する
              </Button>
            </Link>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 space-y-2">
              <div>
                <p className="text-xs font-semibold text-gray-700">参加者に共有</p>
                <p className="text-[10px] text-gray-400">LINEで送るか、リンクをコピーできます</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://line.me/R/msg/text/?${encodeURIComponent(`「${event.title}」の日程を確認してください →\n空いてるコマをタップするだけ！\n${getParticipantUrl(eventId)}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("line_share_click", { source: "event_page" })}
                  className="flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-[#06C755] hover:bg-[#05a847] transition-colors rounded-lg px-4 py-2"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                  LINEで共有
                </a>
                <CopyButton
                  text={getParticipantUrl(eventId)}
                  label="リンクをコピー"
                  className="w-full justify-center bg-white border border-gray-300 text-gray-800 hover:bg-gray-50"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {!summaryLoaded ? (
        <KOMAROLoader />
      ) : (
      <>
      <div className="grid md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_320px] gap-6">
        {/* Main: Table */}
        <FadeInSection delay={80} className="min-w-0">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            {displayMaxCount > 0 ? (
              <p className="text-xs text-gray-500">
                最多 <span className="font-bold text-red-600">{displayMaxCount}名</span> 参加可能
              </p>
            ) : <span />}
            {participants.length > 0 && (
              <button
                onClick={downloadCSV}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border bg-white text-gray-600 border-gray-200 hover:border-gray-300 transition-colors"
              >
                <Download size={12} />
                CSV
              </button>
            )}
          </div>

          {event.tableType === "date" ? (
            <DateCalendarSummary
              rowLabels={event.rowLabels}
              cells={displayCells}
              maxCount={displayMaxCount}
              totalParticipants={participants.length}
              onDateClick={(rowIndex) => handleCellClick(rowIndex, 0)}
            />
          ) : (
            <AvailabilityTable
              rowLabels={event.rowLabels}
              colLabels={event.colLabels}
              rowMeta={event.rowMeta}
              mode="view"
              cells={displayCells}
              maxCount={displayMaxCount}
              onCellClick={handleCellClick}
            />
          )}
        </FadeInSection>

        {/* Sidebar: Members */}
        <FadeInSection delay={160} className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-gray-500" />
              <h2 className="font-semibold text-gray-900 text-sm">参加者一覧</h2>
              <span className="text-xs text-gray-400">({participants.length}名)</span>
              {participants.length > 0 && (
                <span className="ml-auto text-xs text-gray-300">長押しで修正/削除</span>
              )}
            </div>
            {participants.length === 0 ? (
              <div>
                <p className="text-sm text-gray-400">まだ回答者がいません</p>
                {!isExpired && (
                  <p className="text-xs text-gray-400 mt-1">上のURLを共有して回答を集めましょう</p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-48 sm:max-h-64 overflow-y-auto">
                {participants.map((p) => (
                  <button
                    key={p.id}
                    onPointerDown={() => handleParticipantPointerDown(p.id, p.name)}
                    onPointerUp={() => handleParticipantPointerUp(p.name)}
                    onPointerLeave={handleParticipantPointerCancel}
                    onPointerCancel={handleParticipantPointerCancel}
                    className={`px-2.5 py-1 rounded-full text-sm border transition-colors select-none ${
                      filterNames.has(p.name)
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {participants.length > 0 && filterNames.size < participants.length && (
              <button
                onClick={() => setFilterNames(new Set(participants.map((p) => p.name)))}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                フィルタを解除
              </button>
            )}
          </div>

          {/* Edit link */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <Link href={`/e/${eventId}/edit`}>
              <Button variant="secondary" size="sm" className="w-full text-xs">
                イベントを編集する
              </Button>
            </Link>
          </div>
        </FadeInSection>
      </div>

      {/* Comments */}
      <FadeInSection delay={100}>
      <details className="mt-8 rounded-xl border border-gray-200 bg-gray-50/70" open={comments.length > 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <MessageSquare size={15} className="text-gray-400" />
          <span>コメント</span>
          {comments.length > 0 && (
            <span className="text-xs text-gray-400">{comments.length}件</span>
          )}
          <span className="ml-auto text-xs text-gray-400">任意</span>
        </summary>
        <div className="border-t border-gray-200 bg-white px-4 py-4 sm:px-5">

        {comments.length > 0 && (
          <div className="space-y-0 mb-5 max-h-72 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="border-b border-gray-100 py-3 last:border-0 last:pb-0 first:pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-800">
                    {c.authorName ?? "匿名"}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        {comments.length === 0 && !isExpired && (
          <p className="text-sm text-gray-400 mb-4">まだコメントはありません</p>
        )}
        {comments.length === 0 && isExpired && (
          <p className="text-sm text-gray-400">コメントはありません</p>
        )}

        {!isExpired && (
          <div className={comments.length > 0 ? "border-t border-gray-100 pt-4" : ""}>
            <textarea
              placeholder="コメントを入力..."
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="名前（任意）"
                value={commentAuthor}
                onChange={(e) => {
                  setCommentAuthor(e.target.value);
                  localStorage.setItem("komaro_comment_author", e.target.value);
                }}
                maxLength={30}
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <Button
                onClick={submitComment}
                loading={submittingComment}
                disabled={!commentBody.trim()}
                className="px-4 shrink-0"
              >
                <Send size={15} />
              </Button>
            </div>
          </div>
        )}
        </div>
      </details>
      </FadeInSection>

      {/* CTA: 参加者→主催者転換バナー */}
      <FadeInSection delay={200}>
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">次は自分でイベントを作ろう</p>
            <p className="text-xs text-gray-500 mt-0.5">KOMAROで日程調整イベントを無料で作成できます</p>
          </div>
          <Link
            href="/create"
            onClick={() => trackEvent("create_from_event_cta", { source_event_id: eventId })}
            className="w-full shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors sm:w-auto"
          >
            イベントを作成する →
          </Link>
        </div>
      </FadeInSection>
      </>
      )}

      {/* Participant action modal */}
      {longPressTarget && !showDeleteConfirm && (
        <Modal
          open
          onClose={() => setLongPressTarget(null)}
          title={`「${longPressTarget.name}」の回答`}
        >
          <div className="flex flex-col gap-2">
            <Button
              className="w-full gap-2"
              onClick={() => {
                router.push(`/e/${eventId}/answer?edit=${longPressTarget.id}`);
                setLongPressTarget(null);
              }}
            >
              <Edit3 size={14} />
              回答を修正する
            </Button>
            <Button
              variant="danger"
              className="w-full gap-2"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} />
              回答を削除する
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setLongPressTarget(null)}
            >
              キャンセル
            </Button>
          </div>
        </Modal>
      )}

      {/* Participant delete confirmation modal */}
      {longPressTarget && showDeleteConfirm && (
        <Modal
          open
          onClose={() => { setShowDeleteConfirm(false); setLongPressTarget(null); }}
          title="回答を削除しますか？"
        >
          <p className="text-sm text-gray-600 mb-4">
            「{longPressTarget.name}」の回答を削除します。この操作は取り消せません。
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setShowDeleteConfirm(false); setLongPressTarget(null); }}
            >
              キャンセル
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDeleteParticipant}
              loading={deletingParticipant}
            >
              <Trash2 size={14} className="mr-1" />
              削除する
            </Button>
          </div>
        </Modal>
      )}

      {/* Cell detail modal */}
      {selectedCell !== null && (() => {
        const r = selectedCell.r;
        const c = selectedCell.c;
        const colLabel = ensureWeekday(event.colLabels[c] ?? "");
        const rowLabel = event.rowLabels[r] ?? "";
        const meta = event.rowMeta?.[r];
        // Try to build calendar date/time
        const baseDate = parseColLabelToDate(colLabel);
        const startTime = meta?.start ?? (rowLabel.match(/^\d{1,2}:\d{2}$/) ? rowLabel : undefined);
        const endTime = meta?.end;
        const dateRange = baseDate ? buildDateRange(baseDate, startTime, endTime) : null;
        const calendarParams: CalendarEventParams = {
          eventId,
          title: event.title,
          startDate: dateRange?.start ?? null,
          endDate: dateRange?.end ?? null,
          description: cellParticipants
            ? `参加可能者: ${cellParticipants.available.join("、") || "なし"}`
            : undefined,
        };
        const copyText = [
          `📅 ${event.title}`,
          `日時: ${colLabel} ${startTime ?? rowLabel}${endTime ? `〜${endTime}` : ""}`,
          cellParticipants
            ? `参加可能者 (${cellParticipants.available.length}名): ${cellParticipants.available.join("、") || "なし"}`
            : "",
          "",
          "── カレンダーに追加 ──",
          `Google: ${buildShortCalendarUrl("google", calendarParams)}`,
          `Yahoo:  ${buildShortCalendarUrl("yahoo", calendarParams)}`,
          `Outlook: ${buildShortCalendarUrl("outlook", calendarParams)}`,
          `Apple: ${buildShortCalendarUrl("apple", calendarParams)}`,
          `TimeTree: ${buildShortCalendarUrl("timetree", calendarParams)}`,
          `その他(.ics): ${buildShortCalendarUrl("other", calendarParams)}`,
        ]
          .filter(Boolean)
          .join("\n");

        return (
          <Modal
            open
            onClose={() => setSelectedCell(null)}
            title={`${rowLabel} × ${colLabel}`}
          >
            {cellParticipants ? (
              <div className="space-y-5">
                {/* Participants */}
                <div className="space-y-3">
                  <div>
                    {(() => {
                      const filteredAvailable = filterNames.size > 0
                        ? cellParticipants.available.filter((n) => filterNames.has(n))
                        : cellParticipants.available;
                      const countLabel = filterNames.size > 0
                        ? `${filteredAvailable.length}名（全${cellParticipants.available.length}名中）`
                        : `${cellParticipants.available.length}名`;
                      return (
                        <>
                          <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                            参加可能 ({countLabel})
                          </p>
                          {cellParticipants.available.length === 0 ? (
                            <p className="text-sm text-gray-400">なし</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {cellParticipants.available.map((name) => {
                                const isInFilter = filterNames.size === 0 || filterNames.has(name);
                                return (
                                  <span
                                    key={name}
                                    className={`px-2.5 py-1 text-sm rounded-full ${
                                      isInFilter
                                        ? "bg-gray-100 text-gray-800"
                                        : "bg-gray-50 text-gray-300"
                                    }`}
                                  >
                                    {name}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {cellParticipants.unavailable.length > 0 && (
                    <UnavailableList names={cellParticipants.unavailable} />
                  )}
                </div>

                {/* Calendar export */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <CalendarPlus size={14} className="text-gray-400" />
                    <p className="text-xs text-gray-500">
                      {dateRange
                        ? `${colLabel} ${startTime}${endTime ? `〜${endTime}` : ""}`
                        : "日時情報なし（カレンダーアプリで設定してください）"}
                    </p>
                  </div>
                  <CalendarExport params={calendarParams} copyText={copyText} />
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}
          </Modal>
        );
      })()}
    </div>
  );
}
