"use client";

import { useRef, useEffect } from "react";
import { cn, getHeatmapColor, getHeatmapTextColor } from "@/lib/utils";

interface CellSummary {
  rowIndex: number;
  colIndex: number;
  count: number;
  isMax: boolean;
}

interface RowMeta {
  start?: string;
  end?: string;
}

interface AvailabilityTableProps {
  rowLabels: string[];
  colLabels: string[];
  rowMeta?: RowMeta[];
  mode: "view" | "edit";
  cells?: CellSummary[];
  maxCount?: number;
  highlightedParticipantCells?: { rowIndex: number; colIndex: number }[];
  onCellClick?: (rowIndex: number, colIndex: number) => void;
  selectedCells?: Set<string>;
  onCellToggle?: (rowIndex: number, colIndex: number) => void;
}

function cellKey(r: number, c: number) {
  return `${r}-${c}`;
}

const ROW_LABEL_W = 76;
const COL_W = 48;

export function AvailabilityTable({
  rowLabels,
  colLabels,
  rowMeta,
  mode,
  cells = [],
  maxCount = 0,
  highlightedParticipantCells,
  onCellClick,
  selectedCells,
  onCellToggle,
}: AvailabilityTableProps) {
  const cellMap = new Map<string, CellSummary>();
  cells.forEach((c) => cellMap.set(cellKey(c.rowIndex, c.colIndex), c));

  const highlightSet = highlightedParticipantCells
    ? new Set(highlightedParticipantCells.map((c) => cellKey(c.rowIndex, c.colIndex)))
    : null;

  // ── gesture state (all refs so handlers never go stale) ──────────────────
  const containerRef = useRef<HTMLDivElement>(null);

  // Always-current mirror of selectedCells (avoids stale closure in move handler)
  const selectedCellsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedCellsRef.current = selectedCells ?? new Set();
  }, [selectedCells]);

  const isDragging    = useRef(false);
  const dragMode      = useRef<"select" | "deselect">("select");
  const startCell     = useRef<{ r: number; c: number } | null>(null);
  const startPos      = useRef<{ x: number; y: number } | null>(null);
  const didSwipe      = useRef(false);
  // Track cells toggled in this gesture to avoid double-toggle
  const toggledInGesture = useRef(new Set<string>());

  const resetGesture = () => {
    isDragging.current    = false;
    didSwipe.current      = false;
    startCell.current     = null;
    startPos.current      = null;
    toggledInGesture.current = new Set();
  };

  const tableWidth = ROW_LABEL_W + colLabels.length * COL_W;

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-xl border border-gray-200 shadow-sm select-none relative z-0"

      // ── container-level pointer handlers ────────────────────────────────
      // pointermove fires on the container because the cell transfers pointer
      // capture here in onPointerDown. elementFromPoint() tells us which cell
      // is actually under the finger — this works on iOS, Android and desktop.
      onPointerMove={(e) => {
        if (!isDragging.current || !onCellToggle) return;

        // Ignore micro-movement so a normal tap doesn't accidentally start a swipe
        const dx = e.clientX - (startPos.current?.x ?? e.clientX);
        const dy = e.clientY - (startPos.current?.y ?? e.clientY);
        if (Math.sqrt(dx * dx + dy * dy) < 8) return;
        didSwipe.current = true;

        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const key = el?.getAttribute("data-cell");
        if (!key || toggledInGesture.current.has(key)) return;

        const [r, c] = key.split("-").map(Number);
        const isSel = selectedCellsRef.current.has(key);
        if (dragMode.current === "select"   && !isSel) { toggledInGesture.current.add(key); onCellToggle(r, c); }
        if (dragMode.current === "deselect" &&  isSel) { toggledInGesture.current.add(key); onCellToggle(r, c); }
      }}

      onPointerUp={() => {
        if (isDragging.current && !didSwipe.current && startCell.current && onCellToggle) {
          // Pure tap — toggle the cell that was pressed
          onCellToggle(startCell.current.r, startCell.current.c);
        }
        resetGesture();
      }}
      onPointerCancel={resetGesture}
      onPointerLeave={resetGesture}
    >
      <table
        className="border-collapse table-fixed"
        style={{ width: tableWidth, minWidth: tableWidth }}
      >
        <colgroup>
          <col style={{ width: ROW_LABEL_W }} />
          {colLabels.map((_, ci) => <col key={ci} style={{ width: COL_W }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200" />
            {colLabels.map((col, ci) => (
              <th
                key={ci}
                className="bg-gray-50 border-b border-r border-gray-200 px-0.5 py-1.5 text-center text-[10px] font-semibold text-gray-600 leading-tight overflow-hidden"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((row, ri) => (
            <tr key={ri}>
              <td className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 overflow-hidden">
                <div className="truncate">{row}</div>
                {rowMeta?.[ri]?.start && (
                  <div className="text-[9px] text-gray-400 font-normal truncate">
                    {rowMeta[ri].start}〜{rowMeta[ri].end}
                  </div>
                )}
              </td>
              {colLabels.map((_, ci) => {
                const key = cellKey(ri, ci);
                const summary = cellMap.get(key);
                const isSelected = selectedCells?.has(key) ?? false;
                const isHighlighted = highlightSet?.has(key) ?? false;
                const isFiltered = highlightSet !== null && !isHighlighted;

                if (mode === "edit") {
                  return (
                    <td
                      key={ci}
                      data-cell={key}
                      // touch-action:none prevents iOS/Android from claiming the
                      // touch for native scroll so pointer events fire on every move.
                      // Headers/labels keep their default touch-action for scrolling.
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => {
                        if (!onCellToggle) return;
                        e.preventDefault();
                        // Transfer pointer capture to the container so that
                        // onPointerMove above always receives move events — even
                        // as the finger slides across multiple cells on iOS.
                        containerRef.current?.setPointerCapture(e.pointerId);
                        isDragging.current = true;
                        didSwipe.current   = false;
                        startCell.current  = { r: ri, c: ci };
                        startPos.current   = { x: e.clientX, y: e.clientY };
                        dragMode.current   = selectedCellsRef.current.has(key) ? "deselect" : "select";
                        toggledInGesture.current = new Set();
                      }}
                      className={cn(
                        "border-b border-r border-gray-200 text-center cursor-pointer transition-colors h-10",
                        isSelected ? "bg-gray-900 hover:bg-gray-700" : "bg-white hover:bg-gray-50"
                      )}
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`${row} ${colLabels[ci]} ${isSelected ? "選択中" : "未選択"}`}
                    >
                      {isSelected && (
                        <span className="text-white text-sm leading-none">✓</span>
                      )}
                    </td>
                  );
                }

                return (
                  <td
                    key={ci}
                    onClick={() => onCellClick?.(ri, ci)}
                    className={cn(
                      "border-b border-r border-gray-200 text-center cursor-pointer transition-all h-10",
                      summary && summary.count > 0
                        ? getHeatmapColor(summary.count, maxCount)
                        : "bg-white hover:bg-gray-50",
                      summary?.isMax && "ring-2 ring-inset ring-white/40",
                      isFiltered && "opacity-20"
                    )}
                    aria-label={`${row} ${colLabels[ci]} ${summary?.count ?? 0}名参加可能`}
                  >
                    {summary && summary.count > 0 && (
                      <span className={cn("text-xs font-bold leading-none", getHeatmapTextColor(summary.count, maxCount))}>
                        {summary.count}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
