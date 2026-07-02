"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  rowLabels: string[];
  selectedCells: Set<string>; // keys are "rowIndex-0"
  onToggle: (rowIndex: number) => void;
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

export function DateCalendarAnswer({ rowLabels, selectedCells, onToggle }: Props) {
  const dateMap = new Map<string, number>(); // dateStr → rowIndex
  rowLabels.forEach((label, rowIndex) => {
    const key = parseLabelToDateStr(label);
    if (key) dateMap.set(key, rowIndex);
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
          <div key={d} className="h-8 flex items-center justify-center text-xs text-gray-400 font-medium">
            {d}
          </div>
        ))}
        {gridCells.map((dateStr, i) => {
          if (!dateStr) return <div key={`pad-${i}`} />;
          const dayNum = parseInt(dateStr.split("-")[2]);
          const rowIndex = dateMap.get(dateStr);

          if (rowIndex === undefined) {
            return (
              <div key={dateStr} className="h-12 flex items-center justify-center">
                <span className="text-sm text-gray-200">{dayNum}</span>
              </div>
            );
          }

          const isSelected = selectedCells.has(`${rowIndex}-0`);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onToggle(rowIndex)}
              className={`h-12 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-gray-900 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
