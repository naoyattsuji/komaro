"use client";

import { useRef, useCallback, useEffect } from "react";
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

const ROW_LABEL_W = 76; // px — wide enough for "1限（Nm）" or "09:00"
const COL_W = 48;       // px — equal for every data column

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

  // Mouse drag state
  const isDragging = useRef(false);
  const dragMode = useRef<"select" | "deselect">("select");

  // Touch state
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchStartCell = useRef<{ r: number; c: number } | null>(null);
  const touchMoved = useRef(false);
  const touchToggledInGesture = useRef(new Set<string>());
  // Mirror of selectedCells as a ref so the native touchmove handler always reads current state
  const selectedCellsRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedCellsRef.current = selectedCells ?? new Set();
  }, [selectedCells]);

  // Non-passive native touchmove: prevents scroll during swipe-select and toggles cells
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mode !== "edit") return;

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || !touchStartPos.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) <= 8) return;

      touchMoved.current = true;
      e.preventDefault(); // prevent scroll during swipe-select

      const cellEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const key = cellEl?.getAttribute("data-cell");
      if (!key || touchToggledInGesture.current.has(key)) return;

      const [r, c] = key.split("-").map(Number);
      const isSelected = selectedCellsRef.current.has(key);
      if (dragMode.current === "select" && !isSelected) {
        touchToggledInGesture.current.add(key);
        onCellToggle?.(r, c);
      } else if (dragMode.current === "deselect" && isSelected) {
        touchToggledInGesture.current.add(key);
        onCellToggle?.(r, c);
      }
    };

    el.addEventListener("touchmove", handleNativeTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleNativeTouchMove);
  }, [mode, onCellToggle]);

  const handleMouseDown = useCallback(
    (r: number, c: number) => {
      if (mode !== "edit" || !onCellToggle) return;
      isDragging.current = true;
      const key = cellKey(r, c);
      dragMode.current = selectedCells?.has(key) ? "deselect" : "select";
      onCellToggle(r, c);
    },
    [mode, onCellToggle, selectedCells]
  );

  const handleMouseEnter = useCallback(
    (r: number, c: number) => {
      if (mode !== "edit" || !isDragging.current || !onCellToggle) return;
      const key = cellKey(r, c);
      const isSelected = selectedCells?.has(key) ?? false;
      if (dragMode.current === "select" && !isSelected) onCellToggle(r, c);
      if (dragMode.current === "deselect" && isSelected) onCellToggle(r, c);
    },
    [mode, onCellToggle, selectedCells]
  );

  const tableWidth = ROW_LABEL_W + colLabels.length * COL_W;

  return (
    <div
      ref={containerRef}
      className="overflow-auto rounded-xl border border-gray-200 shadow-sm select-none relative z-0"
      onMouseUp={() => { isDragging.current = false; }}
      onMouseLeave={() => { isDragging.current = false; }}
      onTouchEnd={() => {
        // Tap (no significant movement): toggle the cell that was touched
        if (
          mode === "edit" &&
          !touchMoved.current &&
          touchStartCell.current &&
          onCellToggle
        ) {
          onCellToggle(touchStartCell.current.r, touchStartCell.current.c);
        }
        isDragging.current = false;
        touchStartPos.current = null;
        touchStartCell.current = null;
        touchMoved.current = false;
        touchToggledInGesture.current = new Set();
      }}
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
                      onMouseDown={() => handleMouseDown(ri, ci)}
                      onMouseEnter={() => handleMouseEnter(ri, ci)}
                      onTouchStart={(e) => {
                        const touch = e.touches[0];
                        isDragging.current = true;
                        dragMode.current = isSelected ? "deselect" : "select";
                        touchStartPos.current = { x: touch.clientX, y: touch.clientY };
                        touchStartCell.current = { r: ri, c: ci };
                        touchMoved.current = false;
                        touchToggledInGesture.current = new Set();
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
