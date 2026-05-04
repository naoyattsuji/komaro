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
  bestTimeCells?: { rowIndex: number; colIndex: number }[];
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
  bestTimeCells,
  onCellClick,
  selectedCells,
  onCellToggle,
}: AvailabilityTableProps) {
  const cellMap = new Map<string, CellSummary>();
  cells.forEach((c) => cellMap.set(cellKey(c.rowIndex, c.colIndex), c));

  const highlightSet = highlightedParticipantCells
    ? new Set(highlightedParticipantCells.map((c) => cellKey(c.rowIndex, c.colIndex)))
    : null;

  const bestTimeSet = bestTimeCells
    ? new Set(bestTimeCells.map((c) => cellKey(c.rowIndex, c.colIndex)))
    : null;

  // ── always-current mirrors (prevent stale closures in imperative handlers) ──
  const selectedCellsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedCellsRef.current = selectedCells ?? new Set();
  }, [selectedCells]);

  // Updated every render so touch handlers always call the latest callback
  const onCellToggleRef = useRef(onCellToggle);
  useEffect(() => { onCellToggleRef.current = onCellToggle; });

  const tableRef = useRef<HTMLTableElement>(null);

  // ── Mobile: native Touch Events on <table> (non-passive) ──────────────
  //
  // Root cause of previous failures:
  //   Pointer Events + setPointerCapture on an overflow-scroll container
  //   does NOT reliably prevent iOS Safari's native scroll. The browser
  //   decides to scroll before PointerEvents even fire.
  //
  // This approach:
  //   • Attach touchstart/touchmove with { passive: false } to the TABLE
  //     (not the scroll container div), so preventDefault() is always allowed.
  //   • Call preventDefault() only when the touch hits a data cell
  //     (data-cell attr). Touches on headers/labels fall through → scroll works.
  //   • elementFromPoint() is used in touchmove to locate the cell under
  //     the finger — independent of any capture, works on all browsers.
  //
  useEffect(() => {
    if (mode !== "edit") return;
    const table = tableRef.current;
    if (!table) return;

    // Plain local vars — no React state, no risk of stale closures.
    let active   = false;
    let dragMode: "select" | "deselect" = "select";
    let startR   = -1, startC = -1;
    let startX   = 0,  startY = 0;
    let didSwipe = false;
    let toggled  = new Set<string>();

    // Walk up DOM from hit element to find `data-cell` attribute.
    // Needed because elementFromPoint may return a child (e.g. the ✓ span).
    const findKey = (x: number, y: number): string | null => {
      let el = document.elementFromPoint(x, y) as HTMLElement | null;
      while (el) {
        const k = el.getAttribute("data-cell");
        if (k) return k;
        el = el.parentElement;
      }
      return null;
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const key = findKey(t.clientX, t.clientY);
      if (!key) return;          // header / label → allow native scroll
      e.preventDefault();        // cell → block scroll for this gesture
      const [r, c] = key.split("-").map(Number);
      active   = true;
      didSwipe = false;
      startR   = r;  startC = c;
      startX   = t.clientX; startY = t.clientY;
      dragMode = selectedCellsRef.current.has(key) ? "deselect" : "select";
      toggled  = new Set();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      e.preventDefault();        // keep scroll blocked for the whole gesture
      const t = e.touches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.sqrt(dx * dx + dy * dy) < 6) return; // dead-zone
      didSwipe = true;
      const key = findKey(t.clientX, t.clientY);
      if (!key || toggled.has(key)) return;
      const [r, c] = key.split("-").map(Number);
      const isSel = selectedCellsRef.current.has(key);
      if (dragMode === "select"   && !isSel) { toggled.add(key); onCellToggleRef.current?.(r, c); }
      if (dragMode === "deselect" &&  isSel) { toggled.add(key); onCellToggleRef.current?.(r, c); }
    };

    const onTouchEnd = () => {
      if (active && !didSwipe && startR >= 0) {
        // Pure tap — toggle the pressed cell on finger-lift
        onCellToggleRef.current?.(startR, startC);
      }
      active = false;
    };

    table.addEventListener("touchstart",  onTouchStart,  { passive: false });
    table.addEventListener("touchmove",   onTouchMove,   { passive: false });
    table.addEventListener("touchend",    onTouchEnd);
    table.addEventListener("touchcancel", onTouchEnd);

    return () => {
      table.removeEventListener("touchstart",  onTouchStart);
      table.removeEventListener("touchmove",   onTouchMove);
      table.removeEventListener("touchend",    onTouchEnd);
      table.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [mode]); // no dep on onCellToggle — uses ref

  // ── Desktop: mouse drag via React event handlers ───────────────────────
  // onMouseEnter fires freely on desktop (no implicit capture), so this
  // classic pattern is reliable and needs no imperative setup.
  const mouseActive   = useRef(false);
  const mouseDragMode = useRef<"select" | "deselect">("select");
  const mouseToggled  = useRef(new Set<string>());

  useEffect(() => {
    const onMouseUp = () => { mouseActive.current = false; };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, []);

  const tableWidth = ROW_LABEL_W + colLabels.length * COL_W;

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm select-none relative z-0">
      <table
        ref={tableRef}
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
                const isBestTime = bestTimeSet?.has(key) ?? false;

                if (mode === "edit") {
                  return (
                    <td
                      key={ci}
                      data-cell={key}
                      // ── Desktop mouse handlers ──────────────────────────
                      onMouseDown={(e) => {
                        if (!onCellToggle) return;
                        e.preventDefault();
                        const wasSel = selectedCellsRef.current.has(key);
                        mouseActive.current   = true;
                        mouseDragMode.current = wasSel ? "deselect" : "select";
                        mouseToggled.current  = new Set([key]);
                        onCellToggle(ri, ci);
                      }}
                      onMouseEnter={() => {
                        if (!mouseActive.current || !onCellToggle) return;
                        if (mouseToggled.current.has(key)) return;
                        const isSel = selectedCellsRef.current.has(key);
                        if (mouseDragMode.current === "select"   && !isSel) { mouseToggled.current.add(key); onCellToggle(ri, ci); }
                        if (mouseDragMode.current === "deselect" &&  isSel) { mouseToggled.current.add(key); onCellToggle(ri, ci); }
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
                      isFiltered && "opacity-20",
                      isBestTime && "ring-2 ring-inset ring-yellow-400"
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
