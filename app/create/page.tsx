"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { AlertCircle, ChevronDown, ChevronUp, Eye, EyeOff, Lock } from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import { AxisEditor, AxisEditorValue, generateTimeSlots, generateDateLabels } from "@/components/AxisEditor";

type TableType = "timetable" | "calendar" | "date";

const TABLE_TYPE_LABELS: Record<TableType, string> = {
  timetable: "時間割形式（日付/曜日×時限）",
  calendar: "カレンダー形式（日付/曜日×時間帯）",
  date: "日付形式（日付のみ）",
};

interface RowMeta { start: string; end: string; }

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

function defaultAxisValue(tableType: TableType): AxisEditorValue {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (tableType === "timetable") {
    return {
      rowLabels: ["1限", "2限", "昼休憩", "3限", "4限", "5限", "6限", "7限（Nm）"],
      colLabels: generateDateLabels(todayStr, 5),
      rowMeta: DEFAULT_ROW_META.timetable,
    };
  }
  if (tableType === "calendar") {
    return {
      rowLabels: generateTimeSlots("09:00", "18:00", 60),
      colLabels: generateDateLabels(todayStr, 5),
      rowMeta: [],
    };
  }
  // date
  return {
    rowLabels: generateDateLabels(todayStr, 7).slice(0, 30),
    colLabels: [""],
    rowMeta: [],
  };
}

// ── Mini preview grids (text labels + colored cells) ─────────────────────────
const PREVIEW_LEVELS = ["bg-gray-200", "bg-gray-400", "bg-gray-600"] as const;
type PreviewLevel = 0 | 1 | 2;

function MiniPreview({ type }: { type: TableType }) {
  const cell = (v: PreviewLevel, key: number) => (
    <div key={key} className={`w-6 h-3 rounded-[2px] ${PREVIEW_LEVELS[v]}`} />
  );

  if (type === "calendar") {
    const cols = ["5/1", "5/2", "5/3"];
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
    const cols = ["5/1", "5/2", "5/3"];
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

  // date
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

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Step 1
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tableType, setTableType] = useState<TableType>("calendar");

  // Step 2 — managed by AxisEditor, mirrored here for submission
  const [axisValue, setAxisValue] = useState<AxisEditorValue>(() => defaultAxisValue("calendar"));

  // Step 3
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTableTypeChange = (t: TableType) => {
    setTableType(t);
    setAxisValue(defaultAxisValue(t));
  };

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "イベント名を入力してください";
    if (title.trim().length > 60) errs.title = "60文字以内で入力してください";
    if (axisValue.rowLabels.some((l) => !l.trim())) errs.rowLabels = "空のラベルがあります";
    if (tableType !== "date" && axisValue.colLabels.some((l) => !l.trim())) errs.colLabels = "空のラベルがあります";
    if (password && (password.length < 4 || password.length > 20)) {
      errs.password = "パスワードは4〜20文字で入力してください";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [title, axisValue, tableType, password]);

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
          rowLabels: axisValue.rowLabels.map((l) => l.trim()),
          colLabels: axisValue.colLabels.map((l) => l.trim()),
          rowMeta: axisValue.rowMeta.length > 0 ? axisValue.rowMeta : undefined,
          maxParticipants: 50,
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
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1
          className="anim-hero text-2xl font-bold text-gray-900 mb-1"
          style={{ animationDelay: "0ms" }}
        >
          イベントを作成
        </h1>
        <p
          className="anim-hero text-sm text-gray-500"
          style={{ animationDelay: "80ms" }}
        >
          2ステップで日程調整表を作成できます
        </p>
      </div>

      {/* Step indicator */}
      <div
        className="anim-hero flex items-center gap-2 mb-8"
        style={{ animationDelay: "160ms" }}
      >
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => step > s && setStep(s as 1 | 2)}
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
            {s < 2 && (
              <div className={`h-0.5 w-8 ${step > s ? "bg-gray-900" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-gray-500">
          {step === 1 && "基本情報"}
          {step === 2 && "日程の設定"}
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
                  <div className="font-medium text-gray-900 text-sm min-w-0 break-words">{TABLE_TYPE_LABELS[t]}</div>
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

      {/* Step 2: Axis settings + optional password */}
      {step === 2 && (
        <div className="space-y-6">
          <AxisEditor
            key={tableType}
            tableType={tableType}
            initialValue={axisValue}
            onChange={setAxisValue}
            errors={{ rowLabels: errors.rowLabels, colLabels: errors.colLabels }}
            autoGenerate={true}
          />

          {/* Password: collapsible section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span className="min-w-0 flex items-center gap-2">
                <Lock size={15} className="shrink-0 text-gray-400" />
                編集用パスワードを設定する（任意）
              </span>
              {showPasswordSection ? (
                <ChevronUp size={16} className="text-gray-400 shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 shrink-0" />
              )}
            </button>
            {showPasswordSection && (
              <div className="px-4 pb-4 space-y-2 border-t border-gray-100">
                <Input
                  label=""
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  hint="設定しない場合は編集用URLのみでイベントを管理します"
                  placeholder="4〜20文字"
                  maxLength={20}
                />
                {password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showPassword ? "パスワードを隠す" : "パスワードを表示する"}
                  </button>
                )}
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 flex gap-1.5">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span>パスワードを忘れると、編集URLを紛失した場合にイベントを編集できなくなります</span>
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setStep(1)} className="w-full">戻る</Button>
            <Button onClick={handleSubmit} loading={loading} className="w-full">
              イベントを作成する
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
