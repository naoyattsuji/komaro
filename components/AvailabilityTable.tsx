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
  // view mode
  cells?: CellSummary[];
  maxCount?: number;
  highlightedParticipantCells?: { rowIndex: number; colIndex: number }[];
  onCellClick?: (rowIndex: number, colIndex: number) => void;
  // edit mode
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

  // Drag state (shared by both pointer and mouse)
  const isDragging = useRef(false);
  const dragMode = useRef<"select" | "deselect">("select");

  // Always-current mirror of selectedCells so pointer/touch handlers don't
  // operate on stale closure values
  const selectedCellsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedCellsRef.current = selectedCells ?? new Set();
  }, [selectedCells]);

  const tableWidth = ROW_LABEL_W + colLabels.length * COL_W;

  return (
    <div
      className="overflow-auto rounded-xl border border-gray-200 shadow-sm select-none relative z-0"
      // Reset drag when pointer is released anywhere (including outside cells)
      onPointerUp={() => { isDragging.current = false; }}
      onPointerLeave={() => { isDragging.current = false; }}
      onPointerCancel={() => { isDragging.current = false; }}
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
                      // touch-action:none disables native iOS/Android scroll on cells
                      // so pointer events fire reliably for tap and swipe selection.
                      // Scroll still works when starting from header/label areas.
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => {
                        if (!onCellToggle) return;
                        e.preventDefault();
                        // Release implicit touch capture so the pointer is
                        // dispatched to whatever element is under the finger —
                        // this makes onPointerEnter fire on neighbouring cells
                        // during a swipe, enabling multi-cell selection.
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        isDragging.current = true;
                        dragMode.current = selectedCellsRef.current.has(key)
                          ? "deselect"
                          : "select";
                        onCellToggle(ri, ci);
                      }}
                      onPointerEnter={() => {
                        if (!isDragging.current || !onCellToggle) return;
                        const isNowSelected = selectedCellsRef.current.has(key);
                        if (dragMode.current === "select" && !isNowSelected)
                          onCellToggle(ri, ci);
                        if (dragMode.current === "deselect" && isNowSelected)
                          onCellToggle(ri, ci);
                      }}
                      className={cn(
                        "border-b border-r border-gray-200 text-center cursor-pointer transition-colors h-10",
                        isSelected
                          ? "bg-gray-900 hover:bg-gray-700"
                          : "bg-white hover:bg-gray-50"
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
                      <span
                        className={cn(
                          "text-xs font-bold leading-none",
                          getHeatmapTextColor(summary.count, maxCount)
                        )}
                      >
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
