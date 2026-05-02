"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { showToast } from "@/components/ui/Toast";

type TableType = "timetable" | "calendar" | "date";

const TABLE_TYPE_LABELS: Record<TableType, string> = {
  timetable: "時間割形式（曜日×時限）",
  calendar: "カレンダー形式（日付×時間帯）",
  date: "日付形式（日付のみ）",
};


interface RowMeta { start: string; end: string; }

const DEFAULT_ROW_LABELS: Record<TableType, string[]> = {
  timetable: ["1限", "2限", "昼休憩", "3限", "4限", "5限", "6限", "7限（Nm）"],
  calendar: ["午前", "午後", "夜間"],
  date: ["5/1(木)", "5/2(金)", "5/3(土)", "5/4(日)", "5/5(月)"],
};

const DEFAULT_ROW_META: Record<TableType, RowMeta[]> = {
  timetable: [
    { start: "09:00", end: "10:40" },
    { start: "10:50", end: "12:30" },
    { start: "12:30", end: "13:30" },
    { start: "13:30", end: "15:10" },
    { start: "15:20", end: "17:00" },
    { start: "17:10", end: "18:50" },
    { start: "19:00", end: "20:40" },
    { start: "20:50", end: "21:40" },
  ],
  calendar: [],
  date: [],
};

const DEFAULT_COL_LABELS: Record<TableType, string[]> = {
  timetable: ["月", "火", "水", "木", "金", "土"],
  calendar: ["1日(月)", "2日(火)", "3日(水)", "4日(木)", "5日(金)"],
  date: [""],
};

// ── Mini preview grids (text labels + colored cells) ────────────────────
// All types use 3 rows so height is uniform across buttons.
const PREVIEW_LEVELS = ["bg-gray-200", "bg-gray-400", "bg-gray-600"] as const;
type PreviewLevel = 0 | 1 | 2;

function MiniPreview({ type }: { type: TableType }) {
  const cell = (v: PreviewLevel, key: number) => (
    <div key={key} className={`w-6 h-3 rounded-[2px] ${PREVIEW_LEVELS[v]}`} />
  );

  if (type === "calendar") {
    const cols = ["1日", "2日", "3日"];
    const rows: { lbl: string; vals: PreviewLevel[] }[] = [
      { lbl: "10:00", vals: [2, 0, 2] },
      { lbl: "14:00", vals: [0, 2, 1] },
      { lbl: "18:00", vals: [1, 2, 0] },
    ];
    return (
      <div className="shrink-0 flex flex-col gap-px text-[9px] leading-none text-gray-400">
        <div className="flex gap-px mb-0.5">
          <div className="w-9" />
          {cols.map(c => <div key={c} className="w-6 text-center">{c}</div>)}
        </div>
        {rows.map(row => (
          <div key={row.lbl} className="flex gap-px items-center">
            <div className="w-9">{row.lbl}</div>
            {row.vals.map((v, i) => cell(v, i))}
          </div>
        ))}
      </div>
    );
  }

  if (type === "timetable") {
    const cols = ["月", "火", "水"];
    const rows: { lbl: string; vals: PreviewLevel[] }[] = [
      { lbl: "1限", vals: [1, 2, 0] },
      { lbl: "2限", vals: [2, 0, 2] },
      { lbl: "3限", vals: [0, 1, 2] },
    ];
    return (
      <div className="shrink-0 flex flex-col gap-px text-[9px] leading-none text-gray-400">
        <div className="flex gap-px mb-0.5">
          <div className="w-7" />
          {cols.map(c => <div key={c} className="w-6 text-center">{c}</div>)}
        </div>
        {rows.map(row => (
          <div key={row.lbl} className="flex gap-px items-center">
            <div className="w-7">{row.lbl}</div>
            {row.vals.map((v, i) => cell(v, i))}
          </div>
        ))}
      </div>
    );
  }

  // date: 3 rows, single column
  const rows: { lbl: string; v: PreviewLevel }[] = [
    { lbl: "5/1(木)", v: 2 },
    { lbl: "5/2(金)", v: 0 },
    { lbl: "5/3(土)", v: 1 },
  ];
  return (
    <div className="shrink-0 flex flex-col gap-px text-[9px] leading-none text-gray-400">
      <div className="flex gap-px mb-0.5">
        <div className="w-[46px]" />
        <div className="w-6 text-center">参加</div>
      </div>
      {rows.map(row => (
        <div key={row.lbl} className="flex gap-px items-center">
          <div className="w-[46px]">{row.lbl}</div>
          {cell(row.v, 0)}
        </div>
      ))}
    </div>
  );
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

  const selectCls = "text-sm border border-gray-300 rounded-lg px-2 py-2 bg-white appearance-none text-center";
  return (
    <div className="flex items-center gap-1">
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

function generateTimeSlots(start: string, end: string, intervalMin: number): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  if (endMins <= startMins) return [];
  const slots: string[] = [];
  for (let t = startMins; t < endMins; t += intervalMin) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tableType, setTableType] = useState<TableType>("calendar");

  // Step 2 fields
  const [rowLabels, setRowLabels] = useState(DEFAULT_ROW_LABELS.calendar);
  const [colLabels, setColLabels] = useState(DEFAULT_COL_LABELS.calendar);
  const [rowMeta, setRowMeta] = useState<RowMeta[]>(DEFAULT_ROW_META.calendar);

  // Calendar row generator
  const [calRowStart, setCalRowStart] = useState("09:00");
  const [calRowEnd, setCalRowEnd] = useState("18:00");
  const [calRowInterval, setCalRowInterval] = useState<10 | 30 | 60>(60);

  // Calendar col generator
  const todayStr = new Date().toISOString().slice(0, 10);
  const [calColStartDate, setCalColStartDate] = useState(todayStr);
  const [calColDays, setCalColDays] = useState(5);

  // Date row generator (date format)
  const [dateRowStartDate, setDateRowStartDate] = useState(todayStr);
  const [dateRowDays, setDateRowDays] = useState(7);

  // Step 3 fields
  const maxParticipants = "50";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Drag-and-drop for label reordering
  const dragFrom = useRef<{ which: "row" | "col"; index: number } | null>(null);
  const [dragInsertAt, setDragInsertAt] = useState<{ which: "row" | "col"; insertAt: number } | null>(null);
  // Touch DnD refs (separate from HTML5 DnD)
  const touchDragFrom = useRef<{ which: "row" | "col"; index: number } | null>(null);
  const touchInsertAtRef = useRef<{ which: "row" | "col"; insertAt: number } | null>(null);

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

  // Touch drop: reads from refs so no stale-state issues
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

  // Native touchmove listener for touch DnD (non-passive so we can preventDefault)
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchDragFrom.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      let el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      // Walk up DOM to find a drag item
      while (el && !el.dataset.dragIndex) {
        el = el.parentElement;
      }
      if (!el || el.dataset.dragWhich !== touchDragFrom.current.which) return;
      const index = parseInt(el.dataset.dragIndex!);
      const rect = el.getBoundingClientRect();
      const insertAt = touch.clientY < rect.top + rect.height / 2 ? index : index + 1;
      const insertInfo = { which: touchDragFrom.current.which as "row" | "col", insertAt };
      touchInsertAtRef.current = insertInfo;
      setDragInsertAt(insertInfo);
    };
    const handleTouchEnd = () => {
      // Cleanup if touch ended outside a container's onTouchEnd
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

  useEffect(() => {
    if (tableType !== "calendar") return;
    const slots = generateTimeSlots(calRowStart, calRowEnd, calRowInterval);
    setRowLabels(slots.length > 0 ? slots.slice(0, 30) : [""]);
  }, [tableType, calRowStart, calRowEnd, calRowInterval]);

  useEffect(() => {
    if (tableType !== "calendar") return;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const labels: string[] = [];
    const base = new Date(calColStartDate + "T00:00:00");
    for (let i = 0; i < calColDays; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`);
    }
    setColLabels(labels);
  }, [tableType, calColStartDate, calColDays]);

  useEffect(() => {
    if (tableType !== "date") return;
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    const labels: string[] = [];
    const base = new Date(dateRowStartDate + "T00:00:00");
    for (let i = 0; i < dateRowDays; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      labels.push(`${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`);
    }
    setRowLabels(labels.slice(0, 30));
  }, [tableType, dateRowStartDate, dateRowDays]);

  const handleTableTypeChange = (t: TableType) => {
    setTableType(t);
    setRowLabels(DEFAULT_ROW_LABELS[t]);
    setColLabels(DEFAULT_COL_LABELS[t]);
    setRowMeta(DEFAULT_ROW_META[t]);
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
      const next = [...rowLabels];
      next[idx] = val;
      setRowLabels(next);
    } else {
      const next = [...colLabels];
      next[idx] = val;
      setColLabels(next);
    }
  };

  const updateRowMeta = (idx: number, field: "start" | "end", val: string) => {
    const next = [...rowMeta];
    if (!next[idx]) next[idx] = { start: "", end: "" };
    next[idx] = { ...next[idx], [field]: val };
    setRowMeta(next);
  };

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "イベント名を入力してください";
    if (title.trim().length > 60) errs.title = "60文字以内で入力してください";
    if (rowLabels.some((l) => !l.trim())) errs.rowLabels = "空のラベルがあります";
    if (tableType !== "date" && colLabels.some((l) => !l.trim())) errs.colLabels = "空のラベルがあります";
    const max = parseInt(maxParticipants);
    if (password && (password.length < 4 || password.length > 20)) {
      errs.password = "パスワードは4〜20文字で入力してください";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [title, rowLabels, colLabels, password]);

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          tableType,
          rowLabels: rowLabels.map((l) => l.trim()),
          colLabels: colLabels.map((l) => l.trim()),
          rowMeta: rowMeta.length > 0 ? rowMeta : undefined,
          maxParticipants: parseInt(maxParticipants),
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error?.message ?? "エラーが発生しました", "error");
        return;
      }
      router.push(`/create/done?id=${data.event.id}&token=${data.event.editToken}`);
    } catch {
      showToast("通信エラーが発生しました", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">イベントを作成</h1>
        <p className="text-sm text-gray-500">3ステップで日程調整表を作成できます</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => step > s && setStep(s as 1 | 2 | 3)}
              className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${
                step === s
                  ? "bg-gray-900 text-white"
                  : step > s
                  ? "bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {s}
            </button>
            {s < 3 && (
              <div className={`h-0.5 w-8 ${step > s ? "bg-gray-900" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-gray-500">
          {step === 1 && "基本情報"}
          {step === 2 && "軸の設定"}
          {step === 3 && "詳細設定"}
        </span>
      </div>

      {/* Step 1: Basic info */}
      {step === 1 && (
        <div className="space-y-5">
          <Input
            label="イベント名 *"
            placeholder="例: ミーティング日程調整"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            error={errors.title}
            hint={`${title.length}/60文字`}
          />
          <Textarea
            label="イベントの詳細（任意）"
            placeholder="例: 5月中に1回集まる予定です。参加できる日程を教えてください！"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            hint={`${description.length}/500文字`}
          />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">表の形式 *</p>
            <div className="grid gap-3">
              {(["calendar", "timetable", "date"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTableTypeChange(t)}
                  className={`flex items-start justify-between gap-4 text-left p-4 rounded-xl border-2 transition-colors w-full ${
                    tableType === t
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-gray-900 text-sm">{TABLE_TYPE_LABELS[t]}</div>
                  <MiniPreview type={t} />
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={() => {
            if (!title.trim()) { setErrors({ title: "イベント名を入力してください" }); return; }
            setErrors({});
            setStep(2);
          }}>
            次へ: 軸の設定
          </Button>
        </div>
      )}

      {/* Step 2: Axis settings */}
      {step === 2 && (
        <div className="space-y-6">
          {tableType === "date" ? (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">縦軸ラベル（行）— 日付</p>
              {errors.rowLabels && <p className="text-xs text-red-500 mb-2">{errors.rowLabels}</p>}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">開始日</p>
                  <input
                    type="date"
                    value={dateRowStartDate}
                    onChange={(e) => setDateRowStartDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">日数</p>
                  <select
                    value={dateRowDays}
                    onChange={(e) => setDateRowDays(Number(e.target.value))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}日間</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-500">
                  {rowLabels.length}日: {rowLabels[0]} 〜 {rowLabels[rowLabels.length - 1]}
                </div>
              </div>
            </div>
          ) : tableType === "calendar" ? (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">縦軸ラベル（行）— 時間スロット</p>
              {errors.rowLabels && <p className="text-xs text-red-500 mb-2">{errors.rowLabels}</p>}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">開始</p>
                    <TimeSelect value={calRowStart} onChange={setCalRowStart} maxHour={23} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">終了</p>
                    <TimeSelect value={calRowEnd} onChange={setCalRowEnd} maxHour={24} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">間隔</p>
                  <div className="flex gap-2">
                    {([60, 30, 10] as const).map((min) => (
                      <button
                        key={min}
                        onClick={() => setCalRowInterval(min)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          calRowInterval === min
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {min === 60 ? "1時間" : `${min}分`}
                      </button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const slots = generateTimeSlots(calRowStart, calRowEnd, calRowInterval);
                  const over = slots.length > 30;
                  return (
                    <div className={`text-xs rounded-lg px-3 py-2 ${over ? "bg-gray-50 text-gray-600" : "bg-gray-50 text-gray-500"}`}>
                      {slots.length === 0
                        ? "開始時間を終了時間より前に設定してください"
                        : over
                        ? `${slots.length}スロットになります（上限30のため最初の30スロットのみ使用されます）`
                        : `${slots.length}スロット: ${slots[0]} 〜 ${slots[slots.length - 1]}`}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">
                  縦軸ラベル（行） — {rowLabels.length}/30
                </p>
                {tableType === "timetable" && (
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-gray-600 flex items-center gap-1"
                  >
                    時刻設定 {showPassword ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>
              {errors.rowLabels && <p className="text-xs text-red-500 mb-2">{errors.rowLabels}</p>}
              <div
                className="space-y-0"
                onDragOver={(e) => { if (tableType === "timetable") e.preventDefault(); }}
                onDrop={() => tableType === "timetable" && handleDrop("row")}
                onTouchEnd={() => { if (touchDragFrom.current?.which === "row") performTouchDrop("row"); }}
              >
                {rowLabels.map((label, i) => (
                  <React.Fragment key={i}>
                    {tableType === "timetable" && dragInsertAt?.which === "row" && dragInsertAt.insertAt === i && (
                      <div
                        className="h-1 bg-blue-500 rounded mx-1 my-0.5"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop("row")}
                      />
                    )}
                  <div
                    className="flex gap-2 items-center rounded-lg py-1"
                    data-drag-which="row"
                    data-drag-index={i}
                    draggable={tableType === "timetable"}
                    onDragStart={() => handleDragStart("row", i)}
                    onDragOver={(e) => tableType === "timetable" && handleDragOver(e, "row", i)}
                    onDrop={() => tableType === "timetable" && handleDrop("row")}
                    onDragEnd={() => setDragInsertAt(null)}
                  >
                    {tableType === "timetable" && (
                      <div
                        className="touch-none flex-shrink-0 p-1 -m-1 cursor-grab"
                        onTouchStart={() => { touchDragFrom.current = { which: "row", index: i }; }}
                      >
                        <GripVertical size={16} className="text-gray-300" />
                      </div>
                    )}
                    <Input
                      value={label}
                      onChange={(e) => updateLabel("row", i, e.target.value)}
                      placeholder={`縦軸${i + 1}`}
                      maxLength={30}
                      className="flex-1"
                    />
                    {tableType === "timetable" && (
                      <div className="flex gap-1">
                        <input
                          type="time"
                          value={rowMeta[i]?.start ?? ""}
                          onChange={(e) => updateRowMeta(i, "start", e.target.value)}
                          className="w-24 text-xs border border-gray-300 rounded-lg px-2 bg-white"
                        />
                        <input
                          type="time"
                          value={rowMeta[i]?.end ?? ""}
                          onChange={(e) => updateRowMeta(i, "end", e.target.value)}
                          className="w-24 text-xs border border-gray-300 rounded-lg px-2 bg-white"
                        />
                      </div>
                    )}
                    <button
                      onClick={() => removeLabel("row", i)}
                      disabled={rowLabels.length <= 1}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {tableType === "timetable" && dragInsertAt?.which === "row" && dragInsertAt.insertAt === i + 1 && i === rowLabels.length - 1 && (
                    <div
                      className="h-1 bg-blue-500 rounded mx-1 my-0.5"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop("row")}
                    />
                  )}
                  </React.Fragment>
                ))}
              </div>
              <button
                onClick={() => addLabel("row")}
                disabled={rowLabels.length >= 30}
                className="mt-2 flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-30"
              >
                <Plus size={14} /> 縦軸を追加
              </button>
            </div>
          )}

          {tableType === "date" ? null : tableType === "calendar" ? (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">横軸ラベル（列）— 日付</p>
              {errors.colLabels && <p className="text-xs text-red-500 mb-2">{errors.colLabels}</p>}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">開始日</p>
                  <input
                    type="date"
                    value={calColStartDate}
                    onChange={(e) => setCalColStartDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">日数</p>
                  <select
                    value={calColDays}
                    onChange={(e) => setCalColDays(Number(e.target.value))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}日間</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-500">
                  {colLabels.length}日: {colLabels[0]} 〜 {colLabels[colLabels.length - 1]}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                横軸ラベル（列） — {colLabels.length}/20
              </p>
              {errors.colLabels && <p className="text-xs text-red-500 mb-2">{errors.colLabels}</p>}
              <div
                className="space-y-0"
                onDragOver={(e) => { if (tableType === "timetable") e.preventDefault(); }}
                onDrop={() => tableType === "timetable" && handleDrop("col")}
                onTouchEnd={() => { if (touchDragFrom.current?.which === "col") performTouchDrop("col"); }}
              >
                {colLabels.map((label, i) => (
                  <React.Fragment key={i}>
                    {tableType === "timetable" && dragInsertAt?.which === "col" && dragInsertAt.insertAt === i && (
                      <div
                        className="h-1 bg-blue-500 rounded mx-1 my-0.5"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop("col")}
                      />
                    )}
                  <div
                    className="flex gap-2 items-center rounded-lg py-1"
                    data-drag-which="col"
                    data-drag-index={i}
                    draggable={tableType === "timetable"}
                    onDragStart={() => handleDragStart("col", i)}
                    onDragOver={(e) => tableType === "timetable" && handleDragOver(e, "col", i)}
                    onDrop={() => tableType === "timetable" && handleDrop("col")}
                    onDragEnd={() => setDragInsertAt(null)}
                  >
                    {tableType === "timetable" && (
                      <div
                        className="touch-none flex-shrink-0 p-1 -m-1 cursor-grab"
                        onTouchStart={() => { touchDragFrom.current = { which: "col", index: i }; }}
                      >
                        <GripVertical size={16} className="text-gray-300" />
                      </div>
                    )}
                    <Input
                      value={label}
                      onChange={(e) => updateLabel("col", i, e.target.value)}
                      placeholder={`横軸${i + 1}`}
                      maxLength={30}
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeLabel("col", i)}
                      disabled={colLabels.length <= 1}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 flex-shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {tableType === "timetable" && dragInsertAt?.which === "col" && dragInsertAt.insertAt === i + 1 && i === colLabels.length - 1 && (
                    <div
                      className="h-1 bg-blue-500 rounded mx-1 my-0.5"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop("col")}
                    />
                  )}
                  </React.Fragment>
                ))}
              </div>
              <button
                onClick={() => addLabel("col")}
                disabled={colLabels.length >= 20}
                className="mt-2 flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-30"
              >
                <Plus size={14} /> 横軸を追加
              </button>
            </div>
          )}

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-500 mb-3">プレビュー</p>
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ width: 80, minWidth: 80, maxWidth: 80 }} className="bg-gray-100 border border-gray-200 px-2 py-1" />
                    {tableType === "date" ? (
                      <th style={{ width: 52, minWidth: 52, maxWidth: 52 }} className="bg-gray-100 border border-gray-200 px-1 py-1 text-center overflow-hidden text-gray-400">参加可</th>
                    ) : (
                      <>
                        {colLabels.slice(0, 6).map((c, i) => (
                          <th key={i} style={{ width: 52, minWidth: 52, maxWidth: 52 }} className="bg-gray-100 border border-gray-200 px-1 py-1 text-center overflow-hidden">{c || `列${i+1}`}</th>
                        ))}
                        {colLabels.length > 6 && <th style={{ width: 24, minWidth: 24, maxWidth: 24 }} className="bg-gray-100 border border-gray-200 px-1 py-1 text-gray-400 text-center">…</th>}
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rowLabels.slice(0, tableType === "date" ? 10 : undefined).map((r, i) => (
                    <tr key={i}>
                      <td style={{ width: 80, minWidth: 80, maxWidth: 80 }} className="bg-gray-100 border border-gray-200 px-2 py-1 overflow-hidden">
                        <div className="truncate">{r || `行${i+1}`}</div>
                        {tableType === "timetable" && rowMeta[i]?.start && (
                          <div className="text-[9px] text-gray-400 truncate">{rowMeta[i].start}〜{rowMeta[i].end}</div>
                        )}
                      </td>
                      {tableType === "date" ? (
                        <td style={{ width: 52, minWidth: 52, maxWidth: 52 }} className="border border-gray-200 text-center text-gray-300 bg-white h-8">—</td>
                      ) : (
                        <>
                          {colLabels.slice(0, 6).map((_, ci) => (
                            <td key={ci} style={{ width: 52, minWidth: 52, maxWidth: 52 }} className="border border-gray-200 text-center text-gray-300 bg-white h-8">—</td>
                          ))}
                          {colLabels.length > 6 && <td style={{ width: 24 }} className="border border-gray-200 px-1 py-1 text-gray-300 bg-white">…</td>}
                        </>
                      )}
                    </tr>
                  ))}
                  {tableType === "date" && rowLabels.length > 10 && (
                    <tr>
                      <td className="bg-gray-100 border border-gray-200 px-2 py-1 text-gray-400 text-center">…</td>
                      <td className="border border-gray-200 bg-white" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">戻る</Button>
            <Button onClick={() => setStep(3)} className="flex-1">次へ: 詳細設定</Button>
          </div>
        </div>
      )}

      {/* Step 3: Advanced settings */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <Input
              label="編集用パスワード（任意）"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint="設定しない場合は編集用URLのみでイベントを管理します"
              placeholder="4〜20文字"
              maxLength={20}
            />
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2 mt-2">
              ⚠️ パスワードを忘れると、編集URLを紛失した場合にイベントを編集できなくなります
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
            <p className="font-medium text-gray-700">作成するイベントの確認</p>
            <div className="text-gray-600 space-y-1">
              <p>イベント名: <span className="font-medium text-gray-900">{title}</span></p>
              <p>形式: <span className="font-medium text-gray-900">{TABLE_TYPE_LABELS[tableType]}</span></p>

              <p>パスワード: <span className="font-medium text-gray-900">{password ? "設定あり" : "なし"}</span></p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">戻る</Button>
            <Button onClick={handleSubmit} loading={loading} className="flex-1">
              イベントを作成する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
