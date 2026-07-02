"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getHeatmapColor, getHeatmapTextColor } from "@/lib/utils";

interface CellSummary {
  rowIndex: number;
  colIndex: number;
  count: number;
  isMax: boolean;
}

interface Props {
  rowLabels: string[];
  cells: CellSummary[];
  maxCount: number;
  totalParticipants: number;
  onDateClick: (rowIndex: number) => void;
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

export function DateCalendarSummary({ rowLabels, cells, maxCount, totalParticipants, onDateClick }: Props) {
  const dateMap = new Map<string, { rowIndex: number; count: number; isMax: boolean }>();
  rowLabels.forEach((label, rowIndex) => {
    const key = parseLabelToDateStr(label);
    if (!key) return;
    const cell = cells.find((c) => c.rowIndex === rowIndex && c.colIndex === 0);
    dateMap.set(key, { rowIndex, count: cell?.count ?? 0, isMax: cell?.isMax ?? false });
  });

  const eventMonths = Array.from(
    new Set(Array.from(dateMap.keys()).map((d) => d.slice(0, 7)))
  ).sort();

  const [monthIndex, setMonthIndex] = useState(0);

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

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div key={d} className="h-7 flex items-center justify-center text-xs text-gray-400 font-medium">
            {d}
          </div>
        ))}
        {gridCells.map((dateStr, i) => {
          if (!dateStr) return <div key={`pad-${i}`} />;
          const dayNum = parseInt(dateStr.split("-")[2]);
          const data = dateMap.get(dateStr);

          if (!data) {
            return (
              <div key={dateStr} className="h-14 flex flex-col items-center pt-1.5">
                <span className="text-xs text-gray-200">{dayNum}</span>
              </div>
            );
          }

          const hasCount = data.count > 0;
          const bgColor = hasCount ? getHeatmapColor(data.count, maxCount) : "";
          const textColor = hasCount ? getHeatmapTextColor(data.count, maxCount) : "text-gray-300";

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDateClick(data.rowIndex)}
              className={`h-14 flex flex-col items-center pt-1.5 rounded-xl transition-colors ${
                hasCount
                  ? `${bgColor} hover:opacity-80`
                  : "border border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <span className={`text-xs font-medium ${hasCount ? textColor : "text-gray-400"}`}>
                {dayNum}
              </span>
              {hasCount ? (
                <span className={`text-xl font-bold leading-tight ${textColor}`}>
                  {data.count}
                </span>
              ) : totalParticipants > 0 ? (
                <span className="text-sm text-gray-300 leading-tight mt-0.5">0</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {maxCount > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-400 pt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-600 rounded" />
            <span>最多（{maxCount}名）</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded" />
            <span>参加可あり</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 border border-gray-200 rounded" />
            <span>0名</span>
          </div>
        </div>
      )}
    </div>
  );
}
