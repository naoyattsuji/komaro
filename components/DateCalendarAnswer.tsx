"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  rowLabels: string[];
  selectedCells: Set<string>; // "rowIndex-0"
  onSetSelected: (rowIndex: number, selected: boolean) => void;
}

function parseLabelToDateStr(label: string): string | null {
  const match = label?.match(/^(\d+)\/(\d+)/);
  if (!match) return null;
  const month = parseInt(match[1]);
  const day = parseInt(match[2]);
  const today = new Date();
  let year = today.getFullYear();
  const d = new Date(year, month - 1, day);
  if (d.getTime() < today.getTime() - 180 * 24 * 60 * 60 * 1000) year += 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function DateCalendarAnswer({ rowLabels, selectedCells, onSetSelected }: Props) {
  const dateMap = new Map<string, number>(); // dateStr → rowIndex
  rowLabels.forEach((label, rowIndex) => {
    const key = parseLabelToDateStr(label);
    if (key) dateMap.set(key, rowIndex);
  });

  const eventMonths = Array.from(
    new Set(Array.from(dateMap.keys()).map((d) => d.slice(0, 7)))
  ).sort();

  const [monthIndex, setMonthIndex] = useState(0);
  const dragAction = useRef<"add" | "remove" | null>(null);
  const lastDragged = useRef<string | null>(null);

  if (eventMonths.length === 0) {
    return <p className="text-sm text-gray-400">日付データがありません</p>;
  }

  const [yearStr, monthStr] = eventMonths[monthIndex].split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();

  const gridCells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) gridCells.push(null);
  for (let d = 1; d <= lastDate; d++) {
    gridCells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const selectMonth = () => {
    dateMap.forEach((rowIndex, dateStr) => {
      if (dateStr.startsWith(eventMonths[monthIndex])) {
        onSetSelected(rowIndex, true);
      }
    });
  };

  const deselectMonth = () => {
    dateMap.forEach((rowIndex, dateStr) => {
      if (dateStr.startsWith(eventMonths[monthIndex])) {
        onSetSelected(rowIndex, false);
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonthIndex((i) => Math.max(0, i - 1))}
          disabled={monthIndex === 0}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-gray-700">
          {year}年{month}月
        </span>
        <button
          type="button"
          onClick={() => setMonthIndex((i) => Math.min(eventMonths.length - 1, i + 1))}
          disabled={monthIndex === eventMonths.length - 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Month buttons */}
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={selectMonth}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          この月を全選択
        </button>
        <button
          type="button"
          onClick={deselectMonth}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          この月を全解除
        </button>
      </div>

      {/* Calendar grid with drag support */}
      <div
        className="grid grid-cols-7 gap-1 touch-none select-none"
        onPointerDown={(e) => {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const cell = (el as HTMLElement)?.closest("[data-ansdate]") as HTMLElement | null;
          if (!cell) return;
          const dateStr = cell.dataset.ansdate!;
          const rowIndex = dateMap.get(dateStr);
          if (rowIndex === undefined) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const isSelected = selectedCells.has(`${rowIndex}-0`);
          dragAction.current = isSelected ? "remove" : "add";
          lastDragged.current = dateStr;
          onSetSelected(rowIndex, !isSelected);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (dragAction.current === null) return;
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const cell = (el as HTMLElement)?.closest("[data-ansdate]") as HTMLElement | null;
          if (!cell) return;
          const dateStr = cell.dataset.ansdate!;
          if (!dateStr || dateStr === lastDragged.current) return;
          const rowIndex = dateMap.get(dateStr);
          if (rowIndex === undefined) return;
          lastDragged.current = dateStr;
          onSetSelected(rowIndex, dragAction.current === "add");
        }}
        onPointerUp={() => { dragAction.current = null; lastDragged.current = null; }}
        onPointerCancel={() => { dragAction.current = null; lastDragged.current = null; }}
      >
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div key={d} className="h-7 flex items-center justify-center text-xs text-gray-400 font-medium">
            {d}
          </div>
        ))}
        {gridCells.map((dateStr, i) => {
          if (!dateStr) return <div key={`pad-${i}`} />;
          const dayNum = parseInt(dateStr.split("-")[2]);
          const rowIndex = dateMap.get(dateStr);

          if (rowIndex === undefined) {
            return (
              <div key={dateStr} className="h-10 flex items-center justify-center">
                <span className="text-sm text-gray-200">{dayNum}</span>
              </div>
            );
          }

          const isSelected = selectedCells.has(`${rowIndex}-0`);

          return (
            <div
              key={dateStr}
              data-ansdate={dateStr}
              className={`h-10 flex items-center justify-center rounded-full text-sm font-medium transition-colors cursor-pointer ${
                isSelected ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {dayNum}
            </div>
          );
        })}
      </div>
    </div>
  );
}
