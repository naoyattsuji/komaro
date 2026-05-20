"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/Input";

export interface RowMeta { start: string; end: string; }

export interface AxisEditorValue {
  rowLabels: string[];
  colLabels: string[];
  rowMeta: RowMeta[];
}

type CalendarRowInterval = "ampm" | 10 | 30 | 60 | 120;

interface AxisEditorProps {
  tableType: "timetable" | "calendar" | "date";
  initialValue: AxisEditorValue;
  onChange: (value: AxisEditorValue) => void;
  errors?: { rowLabels?: string; colLabels?: string };
  /** true (default) = generators fire on mount; false = generators only fire after user interaction */
  autoGenerate?: boolean;
}

function TimeSelect({ value, onChange, maxHour = 23 }: {
  value: string;
  onChange: (v: string) => void;
  maxHour?: number;
}) {
  const [h, m] = value.split(":").map(Number);
  const hours = Array.from({ length: maxHour + 1 }, (_, i) => i);
  const minutes = [0, 10, 20, 30, 40, 50];
  const safeM = maxHour === 24 && h === 24 ? 0 : m;

  const setH = (newH: number) => {
    const newM = newH === 24 ? 0 : safeM;
    onChange(`${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`);
  };
  const setM = (newM: number) => {
    onChange(`${String(h).padStart(2, "0")}:${String(newM).padStart(2, "0")}`);
  };

  const selectCls = "w-full text-sm border border-gray-300 rounded-lg px-1.5 py-2 bg-white appearance-none text-center sm:px-2";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
      <select value={h} onChange={(e) => setH(Number(e.target.value))} className={selectCls}>
        {hours.map((hv) => (
          <option key={hv} value={hv}>{String(hv).padStart(2, "0")}</option>
        ))}
      </select>
      <span className="text-gray-500 font-medium">:</span>
      <select
        value={safeM}
        onChange={(e) => setM(Number(e.target.value))}
        disabled={maxHour === 24 && h === 24}
        className={selectCls}
      >
        {minutes.map((mv) => (
          <option key={mv} value={mv}>{String(mv).padStart(2, "0")}</option>
        ))}
      </select>
    </div>
  );
}

export function generateTimeSlots(start: string, end: string, intervalMin: number): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins <= startMins) return [];
  const slots: string[] = [];
  for (let t = startMins; t < endMins; t += intervalMin) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return slots;
}

const ALL_DAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function generateDateLabels(startDate: string, days: number): string[] {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const labels: string[] = [];
  const base = new Date(startDate + "T00:00:00");
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`);
  }
  return labels;
}

function detectIntervalFromLabels(labels: string[]): CalendarRowInterval {
  if (labels.length === 2 && labels[0] === "午前" && labels[1] === "午後") return "ampm";
  if (labels.length < 2) return 60;
  const toMins = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const diff = toMins(labels[1]) - toMins(labels[0]);
  if (diff === 10) return 10;
  if (diff === 30) return 30;
  if (diff === 120) return 120;
  return 60;
}

function detectEndFromLabels(labels: string[], interval: number): string {
  if (labels.length === 0) return "18:00";
  const last = labels[labels.length - 1];
  const [h, m] = last.split(":").map(Number);
  const endMins = h * 60 + m + interval;
  return `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
}

function detectDateFromLabel(label: string): string {
  const match = label?.match(/^(\d+)\/(\d+)/);
  if (!match) return new Date().toISOString().slice(0, 10);
  const month = parseInt(match[1]);
  const day = parseInt(match[2]);
  const year = new Date().getFullYear();
  const d = new Date(year, month - 1, day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AxisEditor({
  tableType,
  initialValue,
  onChange,
  errors = {},
  autoGenerate = true,
}: AxisEditorProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [rowLabels, setRowLabels] = useState(initialValue.rowLabels);
  const [colLabels, setColLabels] = useState(initialValue.colLabels);
  const [rowMeta, setRowMeta] = useState<RowMeta[]>(initialValue.rowMeta);
  const [showTimeMeta, setShowTimeMeta] = useState(false);

  // Calendar row generator state — smart-initialized from existing labels
  const [calRowStart, setCalRowStart] = useState(() => {
    if (tableType === "calendar" && /^\d{2}:\d{2}$/.test(initialValue.rowLabels[0] ?? "")) {
      return initialValue.rowLabels[0];
    }
    return "09:00";
  });
  const [calRowInterval, setCalRowInterval] = useState<CalendarRowInterval>(() => {
    if (tableType === "calendar" && initialValue.rowLabels.length >= 2) {
      return detectIntervalFromLabels(initialValue.rowLabels);
    }
    return 60;
  });
  const [calRowEnd, setCalRowEnd] = useState(() => {
    if (tableType === "calendar" && initialValue.rowLabels.length >= 1 && /^\d{2}:\d{2}$/.test(initialValue.rowLabels[0] ?? "")) {
      const interval = detectIntervalFromLabels(initialValue.rowLabels);
      return typeof interval === "number" ? detectEndFromLabels(initialValue.rowLabels, interval) : "18:00";
    }
    return "18:00";
  });

  // Col mode: "date" or "weekday" (shared for calendar & timetable)
  const [colMode, setColMode] = useState<"date" | "weekday">(() => {
    if (tableType === "date") return "date";
    const WEEKDAY_SET = new Set(["日", "月", "火", "水", "木", "金", "土"]);
    return initialValue.colLabels.length > 0 && initialValue.colLabels.every(l => WEEKDAY_SET.has(l))
      ? "weekday" : "date";
  });
  const [weekdaySelection, setWeekdaySelection] = useState<boolean[]>(() => {
    const WEEKDAY_SET = new Set(["日", "月", "火", "水", "木", "金", "土"]);
    if (tableType !== "date" && initialValue.colLabels.length > 0 && initialValue.colLabels.every(l => WEEKDAY_SET.has(l))) {
      return ALL_DAYS.map(d => initialValue.colLabels.includes(d));
    }
    return [false, true, true, true, true, true, false]; // default: 月〜土
  });

  // Col date generator state (shared for calendar & timetable date mode)
  const [calColStartDate, setCalColStartDate] = useState(() => {
    if (tableType !== "date" && initialValue.colLabels.length > 0) {
      return detectDateFromLabel(initialValue.colLabels[0]);
    }
    return todayStr;
  });
  const [calColDays, setCalColDays] = useState(() => {
    if (tableType !== "date" && initialValue.colLabels.length > 0) {
      return Math.min(20, initialValue.colLabels.length);
    }
    return 5;
  });

  // Date row generator state
  const [dateRowStartDate, setDateRowStartDate] = useState(() => {
    if (tableType === "date" && initialValue.rowLabels.length > 0) {
      return detectDateFromLabel(initialValue.rowLabels[0]);
    }
    return todayStr;
  });
  const [dateRowDays, setDateRowDays] = useState(() => {
    if (tableType === "date" && initialValue.rowLabels.length > 0) {
      return Math.min(30, initialValue.rowLabels.length);
    }
    return 7;
  });

  // Guard refs: start as autoGenerate; set to true on first user interaction
  const calRowTouched = useRef(autoGenerate);
  const calColTouched = useRef(autoGenerate);
  const dateRowTouched = useRef(autoGenerate);

  // DnD state
  const dragFrom = useRef<{ which: "row" | "col"; index: number } | null>(null);
  const [dragInsertAt, setDragInsertAt] = useState<{ which: "row" | "col"; insertAt: number } | null>(null);
  const touchDragFrom = useRef<{ which: "row" | "col"; index: number } | null>(null);
  const touchInsertAtRef = useRef<{ which: "row" | "col"; insertAt: number } | null>(null);

  // Notify parent when state changes (skip initial mount)
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    onChange({ rowLabels, colLabels, rowMeta });
  }, [rowLabels, colLabels, rowMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generators
  useEffect(() => {
    if (tableType !== "calendar" || !calRowTouched.current) return;
    if (calRowInterval === "ampm") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRowLabels(["午前", "午後"]);
      return;
    }
    const slots = generateTimeSlots(calRowStart, calRowEnd, calRowInterval);
    setRowLabels(slots.length > 0 ? slots.slice(0, 30) : [""]);
  }, [tableType, calRowStart, calRowEnd, calRowInterval]);

  useEffect(() => {
    if (tableType === "date" || colMode !== "date" || !calColTouched.current) return;
    setColLabels(generateDateLabels(calColStartDate, calColDays));
  }, [tableType, colMode, calColStartDate, calColDays]);

  useEffect(() => {
    if (tableType === "date" || colMode !== "weekday") return;
    const selected = ALL_DAYS.filter((_, i) => weekdaySelection[i]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColLabels(selected.length > 0 ? [...selected] : ["月"]);
  }, [tableType, colMode, weekdaySelection]);

  useEffect(() => {
    if (tableType !== "date" || !dateRowTouched.current) return;
    setRowLabels(generateDateLabels(dateRowStartDate, dateRowDays).slice(0, 30));
  }, [tableType, dateRowStartDate, dateRowDays]);

  // Touch DnD (non-passive so we can preventDefault)
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchDragFrom.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      let el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      while (el && !el.dataset.dragIndex) el = el.parentElement;
      if (!el || el.dataset.dragWhich !== touchDragFrom.current.which) return;
      const index = parseInt(el.dataset.dragIndex!);
      const rect = el.getBoundingClientRect();
      const insertAt = touch.clientY < rect.top + rect.height / 2 ? index : index + 1;
      const insertInfo = { which: touchDragFrom.current.which as "row" | "col", insertAt };
      touchInsertAtRef.current = insertInfo;
      setDragInsertAt(insertInfo);
    };
    const handleTouchEnd = () => {
      if (touchDragFrom.current) {
        touchDragFrom.current = null;
        touchInsertAtRef.current = null;
        setDragInsertAt(null);
      }
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // DnD handlers
  const handleDragStart = (which: "row" | "col", index: number) => {
    dragFrom.current = { which, index };
  };
  const handleDragOver = (e: React.DragEvent, which: "row" | "col", index: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const insertAt = e.clientY < rect.top + rect.height / 2 ? index : index + 1;
    setDragInsertAt({ which, insertAt });
  };
  const handleDrop = (which: "row" | "col") => {
    const from = dragFrom.current;
    if (!from || !dragInsertAt || from.which !== which) {
      setDragInsertAt(null);
      dragFrom.current = null;
      return;
    }
    const fromIdx = from.index;
    let toIdx = dragInsertAt.insertAt;
    if (toIdx > fromIdx) toIdx -= 1;
    if (fromIdx !== toIdx) {
      if (which === "row") {
        const newLabels = [...rowLabels];
        const [moved] = newLabels.splice(fromIdx, 1);
        newLabels.splice(toIdx, 0, moved);
        setRowLabels(newLabels);
        const newMeta = [...rowMeta];
        const [movedMeta] = newMeta.splice(fromIdx, 1);
        newMeta.splice(toIdx, 0, movedMeta ?? { start: "", end: "" });
        setRowMeta(newMeta);
      } else {
        const newLabels = [...colLabels];
        const [moved] = newLabels.splice(fromIdx, 1);
        newLabels.splice(toIdx, 0, moved);
        setColLabels(newLabels);
      }
    }
    dragFrom.current = null;
    setDragInsertAt(null);
  };

  const performTouchDrop = (which: "row" | "col") => {
    const from = touchDragFrom.current;
    const target = touchInsertAtRef.current;
    if (!from || !target || from.which !== which) {
      touchDragFrom.current = null;
      touchInsertAtRef.current = null;
      setDragInsertAt(null);
      return;
    }
    const fromIdx = from.index;
    let toIdx = target.insertAt;
    if (toIdx > fromIdx) toIdx -= 1;
    if (fromIdx !== toIdx) {
      if (which === "row") {
        setRowLabels((prev) => {
          const next = [...prev];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, moved);
          return next;
        });
        setRowMeta((prev) => {
          const next = [...prev];
          const [movedMeta] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, movedMeta ?? { start: "", end: "" });
          return next;
        });
      } else {
        setColLabels((prev) => {
          const next = [...prev];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, moved);
          return next;
        });
      }
    }
    touchDragFrom.current = null;
    touchInsertAtRef.current = null;
    setDragInsertAt(null);
  };

  const addLabel = (which: "row" | "col") => {
    if (which === "row") {
      if (rowLabels.length >= 30) return;
      setRowLabels([...rowLabels, `項目${rowLabels.length + 1}`]);
    } else {
      if (colLabels.length >= 20) return;
      setColLabels([...colLabels, `項目${colLabels.length + 1}`]);
    }
  };

  const removeLabel = (which: "row" | "col", idx: number) => {
    if (which === "row") {
      if (rowLabels.length <= 1) return;
      setRowLabels(rowLabels.filter((_, i) => i !== idx));
      setRowMeta(rowMeta.filter((_, i) => i !== idx));
    } else {
      if (colLabels.length <= 1) return;
      setColLabels(colLabels.filter((_, i) => i !== idx));
    }
  };

  const updateLabel = (which: "row" | "col", idx: number, val: string) => {
    if (which === "row") {
      const next = [...rowLabels]; next[idx] = val; setRowLabels(next);
    } else {
      const next = [...colLabels]; next[idx] = val; setColLabels(next);
    }
  };

  const switchColMode = (mode: "date" | "weekday") => {
    setColMode(mode);
    if (mode === "date") {
      calColTouched.current = true;
      setColLabels(generateDateLabels(calColStartDate, calColDays));
    }
  };

  const toggleWeekday = (i: number) => {
    setWeekdaySelection(prev => {
      if (prev[i] && prev.filter(Boolean).length <= 1) return prev;
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const updateRowMeta = (idx: number, field: "start" | "end", val: string) => {
    const next = [...rowMeta];
    if (!next[idx]) next[idx] = { start: "", end: "" };
    next[idx] = { ...next[idx], [field]: val };
    setRowMeta(next);
  };

  const previewColLimit = tableType === "date" ? 1 : 5;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Row section ── */}
      {tableType === "date" ? (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2 sm:mb-3">縦軸ラベル（行）— 日付</p>
          {errors.rowLabels && <p className="text-xs text-red-500 mb-2">{errors.rowLabels}</p>}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-1">開始日</p>
                <input
                  type="date"
                  value={dateRowStartDate}
                  onChange={(e) => { dateRowTouched.current = true; setDateRowStartDate(e.target.value); }}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white sm:px-3"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-1">日数</p>
                <select
                  value={dateRowDays}
                  onChange={(e) => { dateRowTouched.current = true; setDateRowDays(Number(e.target.value)); }}
                  className="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white sm:px-3"
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}日間</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-500">
              {rowLabels.length}日: {rowLabels[0]} 〜 {rowLabels[rowLabels.length - 1]}
            </div>
          </div>
        </div>
      ) : tableType === "calendar" ? (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2 sm:mb-3">縦軸ラベル（行）— 時間スロット</p>
          {errors.rowLabels && <p className="text-xs text-red-500 mb-2">{errors.rowLabels}</p>}
          <div className="space-y-2.5 sm:space-y-3">
            {calRowInterval !== "ampm" && (
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-1">開始</p>
                  <TimeSelect
                    value={calRowStart}
                    onChange={(v) => { calRowTouched.current = true; setCalRowStart(v); }}
                    maxHour={23}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-1">終了</p>
                  <TimeSelect
                    value={calRowEnd}
                    onChange={(v) => { calRowTouched.current = true; setCalRowEnd(v); }}
                    maxHour={24}
                  />
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">間隔</p>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {([
                  { value: "ampm", label: "午前午後" },
                  { value: 120, label: "2時間" },
                  { value: 60, label: "1時間" },
                  { value: 30, label: "30分" },
                  { value: 10, label: "10分" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => { calRowTouched.current = true; setCalRowInterval(option.value); }}
                    className={`min-w-0 px-1 py-2 rounded-lg text-[12px] font-medium border transition-colors whitespace-nowrap sm:px-2 sm:text-sm ${
                      calRowInterval === option.value
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              if (calRowInterval === "ampm") {
                return (
                  <div className="text-xs rounded-lg px-3 py-2 bg-gray-50 text-gray-500">
                    2スロット: 午前 / 午後
                  </div>
                );
              }
              const slots = generateTimeSlots(calRowStart, calRowEnd, calRowInterval);
              const over = slots.length > 30;
              return (
                <div className={`text-xs rounded-lg px-3 py-2 ${over ? "bg-yellow-50 text-yellow-600" : "bg-gray-50 text-gray-500"}`}>
                  {slots.length === 0
                    ? "開始時間を終了時間より前に設定してください"
                    : over
                    ? `${slots.length}スロット（上限30のため最初の30スロットのみ使用）`
                    : `${slots.length}スロット: ${slots[0]} 〜 ${slots[slots.length - 1]}`}
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* timetable */
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              縦軸ラベル（行） — {rowLabels.length}/30
            </p>
            <button
              type="button"
              onClick={() => setShowTimeMeta(!showTimeMeta)}
              className="text-xs text-gray-600 flex items-center gap-1"
            >
              時刻設定 {showTimeMeta ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          {errors.rowLabels && <p className="text-xs text-red-500 mb-2">{errors.rowLabels}</p>}
          <div
            className="space-y-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop("row")}
            onTouchEnd={() => { if (touchDragFrom.current?.which === "row") performTouchDrop("row"); }}
          >
            {rowLabels.map((label, i) => (
              <React.Fragment key={i}>
                {dragInsertAt?.which === "row" && dragInsertAt.insertAt === i && (
                  <div className="h-1 bg-blue-500 rounded mx-1 my-0.5" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop("row")} />
                )}
                <div
                  className="rounded-lg py-1"
                  data-drag-which="row"
                  data-drag-index={i}
                  draggable
                  onDragStart={() => handleDragStart("row", i)}
                  onDragOver={(e) => handleDragOver(e, "row", i)}
                  onDrop={() => handleDrop("row")}
                  onDragEnd={() => setDragInsertAt(null)}
                >
                  <div className="flex gap-2 items-center">
                    <div
                      className="touch-none flex-shrink-0 p-1 -m-1 cursor-grab"
                      onTouchStart={() => { touchDragFrom.current = { which: "row", index: i }; }}
                    >
                      <GripVertical size={16} className="text-gray-300" />
                    </div>
                    <Input
                      value={label}
                      onChange={(e) => updateLabel("row", i, e.target.value)}
                      placeholder={`縦軸${i + 1}`}
                      maxLength={30}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeLabel("row", i)}
                      disabled={rowLabels.length <= 1}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {showTimeMeta && (
                    <div className="ml-6 mt-1 flex items-center gap-1">
                      <input
                        type="time"
                        value={rowMeta[i]?.start ?? ""}
                        onChange={(e) => updateRowMeta(i, "start", e.target.value)}
                        className="flex-1 min-w-0 text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                      />
                      <span className="text-gray-400 text-xs shrink-0">〜</span>
                      <input
                        type="time"
                        value={rowMeta[i]?.end ?? ""}
                        onChange={(e) => updateRowMeta(i, "end", e.target.value)}
                        className="flex-1 min-w-0 text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                      />
                    </div>
                  )}
                </div>
                {dragInsertAt?.which === "row" && dragInsertAt.insertAt === i + 1 && i === rowLabels.length - 1 && (
                  <div className="h-1 bg-blue-500 rounded mx-1 my-0.5" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDrop("row")} />
                )}
              </React.Fragment>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addLabel("row")}
            disabled={rowLabels.length >= 30}
            className="mt-2 flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-30"
          >
            <Plus size={14} /> 縦軸を追加
          </button>
        </div>
      )}

      {/* ── Col section ── */}
      {tableType === "date" ? null : (
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3">
            <p className="text-sm font-medium text-gray-700">横軸ラベル（列）</p>
            <div className="grid w-[8.5rem] grid-cols-2 rounded-lg border border-gray-200 overflow-hidden text-xs sm:w-auto">
              {(["date", "weekday"] as const).map((mode, idx) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => switchColMode(mode)}
                  className={`px-3 py-1.5 font-medium transition-colors sm:px-4 ${idx > 0 ? "border-l border-gray-200" : ""} ${
                    colMode === mode ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {mode === "date" ? "日付" : "曜日"}
                </button>
              ))}
            </div>
          </div>
          {errors.colLabels && <p className="text-xs text-red-500 mb-2">{errors.colLabels}</p>}

          {colMode === "date" ? (
            <div className="space-y-2.5 sm:space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2 sm:grid-cols-[minmax(0,1fr)_9rem] sm:gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-1">開始日</p>
                  <input
                    type="date"
                    value={calColStartDate}
                    onChange={(e) => { calColTouched.current = true; setCalColStartDate(e.target.value); }}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white sm:px-3"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-1">日数</p>
                  <select
                    value={calColDays}
                    onChange={(e) => { calColTouched.current = true; setCalColDays(Number(e.target.value)); }}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white sm:px-3"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}日間</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-500">
                {colLabels.length}日: {colLabels[0]} 〜 {colLabels[colLabels.length - 1]}
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-7 gap-1.5 sm:flex sm:flex-wrap">
                {ALL_DAYS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(i)}
                    className={`h-9 w-full rounded-lg text-sm font-medium border transition-colors sm:w-9 ${
                      weekdaySelection[i]
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">選択した曜日が列ラベルになります</p>
            </div>
          )}
        </div>
      )}

      {/* ── Preview ── */}
      <div className="rounded-xl border border-gray-200 p-2.5 sm:p-3">
        <p className="text-xs font-medium text-gray-500 mb-2 sm:mb-3">プレビュー</p>
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="border-collapse text-xs min-w-[336px] sm:min-w-0">
            <thead>
              <tr>
                <th className="w-[72px] sm:w-20 bg-gray-50 border border-gray-200 px-1.5 py-1.5 sm:px-2 sm:py-2" />
                {tableType === "date" ? (
                  <th className="w-14 sm:w-16 bg-gray-50 border border-gray-200 px-1.5 py-1.5 sm:px-2 sm:py-2 text-center overflow-hidden text-gray-400">参加可</th>
                ) : (
                  <>
                    {colLabels.slice(0, previewColLimit).map((c, i) => (
                      <th key={i} className="w-14 sm:w-16 bg-gray-50 border border-gray-200 px-1.5 py-1.5 sm:px-2 sm:py-2 text-center overflow-hidden whitespace-nowrap">{c || `列${i + 1}`}</th>
                    ))}
                    {colLabels.length > previewColLimit && <th className="w-8 bg-gray-50 border border-gray-200 px-1 py-1.5 sm:py-2 text-gray-400 text-center">…</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rowLabels.slice(0, tableType === "date" ? 10 : undefined).map((r, i) => (
                <tr key={i}>
                  <td className="w-[72px] sm:w-20 bg-gray-50 border border-gray-200 px-1.5 py-1.5 sm:px-2 sm:py-2 overflow-hidden">
                    <div className="truncate">{r || `行${i + 1}`}</div>
                    {tableType === "timetable" && rowMeta[i]?.start && (
                      <div className="text-[9px] text-gray-400 truncate">{rowMeta[i].start}〜{rowMeta[i].end}</div>
                    )}
                  </td>
                  {tableType === "date" ? (
                    <td className="w-14 sm:w-16 border border-gray-200 text-center text-gray-300 bg-white h-7 sm:h-8">—</td>
                  ) : (
                    <>
                      {colLabels.slice(0, previewColLimit).map((_, ci) => (
                        <td key={ci} className="w-14 sm:w-16 border border-gray-200 text-center text-gray-300 bg-white h-7 sm:h-8">—</td>
                      ))}
                      {colLabels.length > previewColLimit && <td className="w-8 border border-gray-200 px-1 py-1.5 sm:py-2 text-gray-300 bg-white">…</td>}
                    </>
                  )}
                </tr>
              ))}
              {tableType === "date" && rowLabels.length > 10 && (
                <tr>
                  <td className="bg-gray-50 border border-gray-200 px-2 py-1 text-gray-400 text-center">…</td>
                  <td className="border border-gray-200 bg-white" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
