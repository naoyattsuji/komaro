"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AvailabilityTable } from "@/components/AvailabilityTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { showToast } from "@/components/ui/Toast";
import { Users, MessageSquare, Send, Filter, Edit3, CalendarPlus } from "lucide-react";
import {
  formatDateTime,
  parseColLabelToDate,
  buildDateRange,
  buildGoogleCalendarUrl,
  buildYahooCalendarUrl,
  buildOutlookUrl,
  CalendarEventParams,
} from "@/lib/utils";
import { CalendarExport } from "@/components/CalendarExport";
import { CopyButton } from "@/components/CopyButton";
import { getParticipantUrl } from "@/lib/utils";
import { FadeInSection } from "@/components/FadeInSection";

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

export function EventClient({ eventId, initialEvent }: EventClientProps) {
  const [event] = useState(initialEvent);
  const [summary, setSummary] = useState<{ maxCount: number; cells: CellSummary[] }>({ maxCount: 0, cells: [] });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [cellParticipants, setCellParticipants] = useState<{ available: string[]; unavailable: string[] } | null>(null);
  const [filterNames, setFilterNames] = useState<Set<string>>(new Set());
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  const isExpired = event.status === "expired";

  const fetchSummary = useCallback(async () => {
    const res = await fetch(`/api/v1/events/${eventId}/summary`);
    if (!res.ok) return;
    const data = await res.json();
    setSummary(data.summary);
    setParticipants(data.participants);
  }, [eventId]);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/v1/events/${eventId}/comments`);
    if (!res.ok) return;
    const data = await res.json();
    setComments(data.comments);
  }, [eventId]);

  useEffect(() => {
    fetchSummary();
    fetchComments();
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, [fetchSummary, fetchComments]);

  // Auto-select all participants (including newly joined ones)
  useEffect(() => {
    setFilterNames((prev) => {
      const next = new Set(prev);
      participants.forEach((p) => next.add(p.name));
      return next;
    });
  }, [participants]);

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
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
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
          className="anim-hero flex items-start gap-3 flex-wrap"
          style={{ animationDelay: "0ms" }}
        >
          <Badge variant={isExpired ? "expired" : "active"}>
            {isExpired ? "期限切れ" : "受付中"}
          </Badge>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex-1">{event.title}</h1>
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
          className="anim-hero flex flex-col gap-2 mb-5"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex gap-2 flex-wrap">
            <Link href={`/e/${eventId}/answer`}>
              <Button size="lg" className="gap-2">
                <Edit3 size={16} />
                回答する
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 mb-0.5">参加者向けURL</p>
              <span className="text-xs text-gray-500 truncate block">{getParticipantUrl(eventId)}</span>
            </div>
            <CopyButton text={getParticipantUrl(eventId)} label="コピー" />
          </div>
          {/* SNS シェアボタン */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">シェア:</span>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`「${event.title}」の日程調整をKOMARO で行っています。回答よろしくお願いします！`)}&url=${encodeURIComponent(getParticipantUrl(eventId))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-white bg-black hover:bg-gray-800 transition-colors rounded-md px-2.5 py-1.5"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.263 5.632L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"/></svg>
              X でシェア
            </a>
            <a
              href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(getParticipantUrl(eventId))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-white bg-[#06C755] hover:bg-[#05a847] transition-colors rounded-md px-2.5 py-1.5"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
              LINE でシェア
            </a>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Main: Table */}
        <FadeInSection delay={80}>
          {displayMaxCount > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              最多 <span className="font-bold text-red-600">{displayMaxCount}名</span> 参加可能のコマがあります。セルをタップで参加者を確認できます。
            </p>
          )}

          <AvailabilityTable
            rowLabels={event.rowLabels}
            colLabels={event.colLabels}
            rowMeta={event.rowMeta}
            mode="view"
            cells={displayCells}
            maxCount={displayMaxCount}
            onCellClick={handleCellClick}
          />
        </FadeInSection>

        {/* Sidebar: Members */}
        <FadeInSection delay={160} className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-gray-500" />
              <h2 className="font-semibold text-gray-900 text-sm">参加者一覧</h2>
              <span className="text-xs text-gray-400">({participants.length}名)</span>
              {participants.length > 0 && (
                <button
                  className="ml-auto text-xs text-gray-500 sm:hidden"
                  onClick={() => setShowMobileFilter(!showMobileFilter)}
                >
                  <Filter size={12} className="inline mr-1" />
                  フィルタ
                </button>
              )}
            </div>
            {participants.length === 0 ? (
              <p className="text-sm text-gray-400">まだ回答者がいません</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleFilter(p.name)}
                    className={`px-2.5 py-1 rounded-full text-sm border transition-colors ${
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
            {filterNames.size > 0 && (
              <button
                onClick={() => setFilterNames(new Set(participants.map((p) => p.name)))}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                フィルタを解除
              </button>
            )}
          </div>

          {/* Heatmap legend */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">ヒートマップ凡例</p>
            <div className="flex items-center gap-1">
              <div className="w-6 h-5 bg-white border border-gray-200 rounded" />
              <div className="w-6 h-5 bg-gray-100 rounded" />
              <div className="w-6 h-5 bg-gray-200 rounded" />
              <div className="w-6 h-5 bg-gray-400 rounded" />
              <div className="w-6 h-5 bg-gray-600 rounded" />
              <div className="w-6 h-5 bg-red-600 rounded" />
              <span className="text-xs text-gray-500 ml-1">少 → 多</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">赤 = 最多人数のコマ</p>
          </div>

          {/* Edit link */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-2">作成者の方へ</p>
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
      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={16} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">コメント</h2>
          <span className="text-xs text-gray-400">({comments.length}件)</span>
        </div>

        <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-sm text-gray-400">まだコメントはありません</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700">
                  {c.authorName ?? "匿名"}
                </span>
                <span className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>

        {!isExpired && (
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <input
              type="text"
              placeholder="投稿者名（任意）"
              value={commentAuthor}
              onChange={(e) => setCommentAuthor(e.target.value)}
              maxLength={30}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <div className="flex gap-2">
              <textarea
                placeholder="コメントを入力..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                maxLength={200}
                rows={2}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
              <Button
                onClick={submitComment}
                loading={submittingComment}
                disabled={!commentBody.trim()}
                className="self-end px-3"
              >
                <Send size={16} />
              </Button>
            </div>
            <p className="text-xs text-gray-400 text-right">{commentBody.length}/200</p>
          </div>
        )}
      </div>
      </FadeInSection>

      {/* Cell detail modal */}
      {selectedCell !== null && (() => {
        const r = selectedCell.r;
        const c = selectedCell.c;
        const colLabel = event.colLabels[c] ?? "";
        const rowLabel = event.rowLabels[r] ?? "";
        const meta = event.rowMeta?.[r];
        // Try to build calendar date/time
        const baseDate = parseColLabelToDate(colLabel);
        const startTime = meta?.start ?? (rowLabel.match(/^\d{1,2}:\d{2}$/) ? rowLabel : undefined);
        const endTime = meta?.end;
        const dateRange = baseDate ? buildDateRange(baseDate, startTime, endTime) : null;
        const calendarParams: CalendarEventParams = {
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
          `Google: ${buildGoogleCalendarUrl(calendarParams)}`,
          `Yahoo:  ${buildYahooCalendarUrl(calendarParams)}`,
          `Outlook: ${buildOutlookUrl(calendarParams)}`,
          "Apple・タイムツリー・その他: ページ上の「Apple・その他」ボタンから.icsをダウンロード",
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
                    <details className="text-sm">
                      <summary className="text-xs font-semibold text-gray-400 cursor-pointer">
                        参加不可 ({cellParticipants.unavailable.length}名)
                      </summary>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {cellParticipants.unavailable.map((name) => (
                          <span key={name} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-sm rounded-full">
                            {name}
                          </span>
                        ))}
                      </div>
                    </details>
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
