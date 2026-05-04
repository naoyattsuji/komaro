"use client";

import { useState, useRef, useCallback } from "react";
import { FileDown, X, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { parseICS, expandEvents, mapEventsToKOMARO } from "@/lib/icsParser";
import { parseColLabelToDate } from "@/lib/utils";

interface CalendarICSReaderProps {
  rowLabels: string[];
  colLabels: string[];
  onDetected: (availableCells: Set<string>) => void;
}

export function CalendarICSReader({ rowLabels, colLabels, onDetected }: CalendarICSReaderProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [detectedCount, setDetectedCount] = useState(0);
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  const [showDebug, setShowDebug] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".ics") && file.type !== "text/calendar") {
      setStatus("error");
      setMessage(".ics ファイルを選択してください");
      return;
    }

    setStatus("loading");
    setMessage("カレンダーを読み込み中...");

    try {
      const content = await file.text();

      // ICS パース
      const allEvents = parseICS(content);

      if (allEvents.length === 0) {
        setStatus("error");
        setMessage("イベントが見つかりませんでした。正しい .ics ファイルか確認してください。");
        return;
      }

      // KOMARO の日程範囲を計算
      const colDates = colLabels
        .map(l => parseColLabelToDate(l))
        .filter((d): d is Date => d !== null);

      let rangeStart: Date;
      let rangeEnd:   Date;

      if (colDates.length > 0) {
        rangeStart = new Date(Math.min(...colDates.map(d => d.getTime())));
        rangeEnd   = new Date(Math.max(...colDates.map(d => d.getTime())));
        // 終日イベントを含むよう終端に1日加算
        rangeEnd   = new Date(rangeEnd.getTime() + 86400000);
      } else {
        // 日付が読み取れない場合は過去30日〜未来60日を対象
        rangeStart = new Date(Date.now() - 30*86400000);
        rangeEnd   = new Date(Date.now() + 60*86400000);
      }

      // 繰り返しイベント展開
      const expanded = expandEvents(allEvents, rangeStart, rangeEnd);

      // KOMARO グリッドにマッピング
      const { freeCells, busyCells, matchedEvents, unmatchedEvents } = mapEventsToKOMARO(
        expanded, rowLabels, colLabels
      );

      const available = new Set<string>(
        freeCells.map(({ row, col }) => `${row}-${col}`)
      );

      const debug: string[] = [
        `ICS内イベント総数: ${allEvents.length} 件`,
        `対象期間に展開: ${expanded.length} 件`,
        `予定ありコマ: ${busyCells.length} コマ`,
        `空きコマ: ${freeCells.length} コマ`,
      ];

      if (matchedEvents.length > 0) {
        debug.push("─ 検出した予定 ─");
        matchedEvents.slice(0, 10).forEach(ev => {
          const h = String(ev.startDate.getHours()).padStart(2,'0');
          const m = String(ev.startDate.getMinutes()).padStart(2,'0');
          const eh = String(ev.endDate.getHours()).padStart(2,'0');
          const em = String(ev.endDate.getMinutes()).padStart(2,'0');
          const d = `${ev.startDate.getMonth()+1}/${ev.startDate.getDate()}`;
          debug.push(ev.isAllDay
            ? `  ${d} 終日: ${ev.summary}`
            : `  ${d} ${h}:${m}〜${eh}:${em}: ${ev.summary}`
          );
        });
        if (matchedEvents.length > 10) debug.push(`  … 他 ${matchedEvents.length-10} 件`);
      }

      if (unmatchedEvents.length > 0) {
        debug.push(`対象外の予定: ${unmatchedEvents.length} 件（日程範囲外）`);
      }

      setDebugLines(debug);
      setPendingCells(available);
      setDetectedCount(available.size);

      if (available.size === 0) {
        setStatus("error");
        setMessage("空きコマが見つかりませんでした。全ての時間帯に予定が入っています。");
      } else {
        setStatus("done");
        setMessage(`${available.size}コマの空き時間を検出しました`);
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("ファイルの読み込みに失敗しました。");
    }
  }, [rowLabels, colLabels]);

  const handleApply = () => {
    onDetected(pendingCells);
    setOpen(false);
    reset();
  };

  const reset = () => {
    setStatus("idle");
    setMessage("");
    setDetectedCount(0);
    setPendingCells(new Set());
    setDebugLines([]);
    setShowDebug(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-2.5 py-1 transition-colors"
      >
        <FileDown size={12} />
        .icsから自動入力
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileDown size={15} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-800">カレンダーから自動入力 (.ics)</span>
        </div>
        <button type="button" onClick={() => { setOpen(false); reset(); }} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        カレンダーアプリからエクスポートした <strong>.ics ファイル</strong>をアップロードすると、
        空き時間を正確に自動検出します。
      </p>

      {/* エクスポート手順 */}
      <details className="text-xs text-gray-400">
        <summary className="cursor-pointer hover:text-gray-600 select-none">.ics の出し方</summary>
        <ul className="mt-2 space-y-1 pl-3 list-disc">
          <li><strong>Google カレンダー</strong>: 設定 → [カレンダー名] → カレンダーのエクスポート</li>
          <li><strong>Apple カレンダー</strong>: カレンダーを右クリック → 書き出す</li>
          <li><strong>Outlook</strong>: ファイル → 開く/エクスポート → インポート/エクスポート → iCalendar (.ics) ファイルとしてエクスポート</li>
        </ul>
      </details>

      {/* アップロードエリア */}
      {status === "idle" && (
        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <FileDown size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">タップして .ics を選択</p>
          <p className="text-xs text-gray-400 mt-1">またはドラッグ＆ドロップ</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {/* ステータス */}
      {status !== "idle" && (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
          status === "loading" ? "bg-gray-50 text-gray-600" :
          status === "done"   ? "bg-green-50 text-green-700" :
          "bg-red-50 text-red-600"
        }`}>
          {status === "loading" && <Loader2 size={14} className="animate-spin shrink-0" />}
          {status === "done"    && <CheckCircle size={14} className="shrink-0" />}
          {status === "error"   && <AlertCircle size={14} className="shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      {/* デバッグ詳細 */}
      {debugLines.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          >
            {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            読み取り詳細
          </button>
          {showDebug && (
            <div className="mt-1 bg-gray-50 rounded p-2 space-y-0.5">
              {debugLines.map((l, i) => (
                <p key={i} className="text-[10px] text-gray-500 font-mono">{l}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
        >
          やり直す
        </button>
        {status === "done" && (
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2 hover:bg-gray-700 transition-colors"
          >
            {detectedCount}コマを適用する
          </button>
        )}
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        ※ ファイルはブラウザ内のみで処理され、サーバーに送信されません。
      </p>
    </div>
  );
}
