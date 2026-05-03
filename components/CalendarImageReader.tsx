"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, X, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { parseTimeToMinutes } from "@/lib/utils";

interface CalendarImageReaderProps {
  /** KOMARo イベントの行ラベル（時間）例: ["10:00","12:00","14:00"] */
  rowLabels: string[];
  /** KOMARo イベントの列ラベル（日付）例: ["5/7(水)","5/8(木)"] */
  colLabels: string[];
  /** 自動入力結果を親に渡す */
  onDetected: (availableCells: Set<string>) => void;
}

interface Word {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

// ──────────────────────────────────────────────
// OCR 結果から空きコマを検出するコアロジック
// ──────────────────────────────────────────────
function detectAvailableSlots(
  words: Word[],
  rowLabels: string[],
  colLabels: string[]
): { available: Set<string>; busyMinutes: number[][]; debug: string[] } {
  const debug: string[] = [];

  // 信頼度の低い単語を除外
  const filtered = words.filter((w) => w.confidence > 40 && w.text.trim().length > 0);

  if (filtered.length === 0) {
    return { available: new Set(), busyMinutes: [], debug: ["テキストを検出できませんでした"] };
  }

  // 画像幅の推定（全単語の最大 x1）
  const imgWidth = Math.max(...filtered.map((w) => w.bbox.x1));
  const imgHeight = Math.max(...filtered.map((w) => w.bbox.y1));

  // ── ① 時間ラベル列を特定する ──
  // 左端（x0 < 画像幅の 25%）にある時間パターンを行ラベルとみなす
  const TIME_COL_LIMIT = imgWidth * 0.25;

  const timeLabels: { minutes: number; y0: number; y1: number }[] = [];
  for (const w of filtered) {
    if (w.bbox.x0 > TIME_COL_LIMIT) continue;
    const m = parseTimeToMinutes(w.text);
    if (m !== null) {
      timeLabels.push({ minutes: m, y0: w.bbox.y0, y1: w.bbox.y1 });
    }
  }

  // y座標でソート
  timeLabels.sort((a, b) => a.y0 - b.y0);
  debug.push(`検出した時刻ラベル: ${timeLabels.map((t) => `${Math.floor(t.minutes / 60)}:${String(t.minutes % 60).padStart(2, "0")}(y=${t.y0})`).join(", ")}`);

  if (timeLabels.length < 2) {
    debug.push("時刻ラベルが2つ未満 → 判定できません");
    return { available: new Set(), busyMinutes: [], debug };
  }

  // ── ② 各時刻スロットの y 範囲を計算 ──
  const slots: { minutes: number; y0: number; y1: number }[] = [];
  for (let i = 0; i < timeLabels.length; i++) {
    const y0 = timeLabels[i].y0;
    const y1 = i + 1 < timeLabels.length
      ? timeLabels[i + 1].y0
      : imgHeight;
    slots.push({ minutes: timeLabels[i].minutes, y0, y1 });
  }

  // ── ③ 各スロットに「イベントテキスト」があるか判定 ──
  // 時刻ラベル列（左 25%）以外の領域にテキストがあれば busy とみなす
  const busyMinutes: number[] = []; // busy な時間帯の開始分
  for (const slot of slots) {
    const hasEvent = filtered.some(
      (w) =>
        w.bbox.x0 > TIME_COL_LIMIT &&       // 時刻ラベル列より右
        w.bbox.y0 >= slot.y0 - 5 &&          // スロット内（少し余裕を持つ）
        w.bbox.y0 < slot.y1 - 5 &&
        parseTimeToMinutes(w.text) === null   // 時刻テキスト自体は除外
    );
    if (hasEvent) busyMinutes.push(slot.minutes);
  }

  debug.push(`Busy な時間帯: ${busyMinutes.map((m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`).join(", ") || "なし"}`);

  // ── ④ KOMARo の行ラベルと照合 ──
  const available = new Set<string>();

  for (let ri = 0; ri < rowLabels.length; ri++) {
    const rowMinutes = parseTimeToMinutes(rowLabels[ri]);
    if (rowMinutes === null) continue;

    // この時間帯が busy かどうか
    const isBusy = busyMinutes.some((bm) => {
      // 30分の余裕を持って判定
      return Math.abs(bm - rowMinutes) < 60;
    });

    if (!isBusy) {
      // すべての列で空きとしてマーク
      for (let ci = 0; ci < colLabels.length; ci++) {
        available.add(`${ri}-${ci}`);
      }
    }
  }

  debug.push(`KOMARo で空きマークしたコマ数: ${available.size}`);
  return { available, busyMinutes: [], debug };
}

// ──────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────
export function CalendarImageReader({ rowLabels, colLabels, onDetected }: CalendarImageReaderProps) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [detectedCount, setDetectedCount] = useState(0);
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  const [showDebug, setShowDebug] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("画像ファイルを選択してください");
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setStatus("loading");
    setMessage("カレンダーを読み取り中...");

    try {
      // Tesseract.js を動的インポート（SSR回避）
      const { createWorker } = await import("tesseract.js");

      const worker = await createWorker(["jpn", "eng"], 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setMessage(`読み取り中... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const result = await worker.recognize(file, {}, { blocks: true });
      await worker.terminate();

      // Word レベルのデータを取得
      const words: Word[] = [];
      for (const block of result.data.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          for (const line of para.lines ?? []) {
            for (const word of line.words ?? []) {
              if (word.text.trim()) {
                words.push({
                  text: word.text.trim(),
                  bbox: word.bbox,
                  confidence: word.confidence,
                });
              }
            }
          }
        }
      }

      if (words.length === 0) {
        setStatus("error");
        setMessage("テキストを検出できませんでした。より鮮明なスクリーンショットをお試しください。");
        return;
      }

      const { available, debug } = detectAvailableSlots(words, rowLabels, colLabels);
      setDebugLines(debug);
      setPendingCells(available);
      setDetectedCount(available.size);

      if (available.size === 0) {
        setStatus("error");
        setMessage("空き時間を検出できませんでした。時間帯ラベルが見えるカレンダーのスクリーンショットをお試しください。");
      } else {
        setStatus("done");
        setMessage(`${available.size}コマの空き時間を検出しました`);
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("読み取り中にエラーが発生しました。別の画像をお試しください。");
    }
  }, [rowLabels, colLabels]);

  const handleApply = () => {
    onDetected(pendingCells);
    setOpen(false);
    reset();
  };

  const reset = () => {
    setImageUrl(null);
    setStatus("idle");
    setMessage("");
    setDetectedCount(0);
    setPendingCells(new Set());
    setDebugLines([]);
    setShowDebug(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-400 rounded-lg px-2.5 py-1 transition-colors"
      >
        <Camera size={12} />
        スクショから自動入力（β）
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={15} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-800">カレンダーから自動入力（β）</span>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); reset(); }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        カレンダーアプリのスクリーンショットをアップロードすると、空き時間を自動で検出してコマを選択します。
        内容を確認してから送信してください。
      </p>

      {/* アップロードエリア */}
      {!imageUrl ? (
        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <Camera size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">タップして画像を選択</p>
          <p className="text-xs text-gray-400 mt-1">またはドラッグ＆ドロップ</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* プレビュー */}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="カレンダープレビュー"
              className="w-full max-h-48 object-contain rounded-lg border border-gray-100"
            />
            {status === "idle" && (
              <button
                type="button"
                onClick={reset}
                className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-500 hover:text-gray-700"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* ステータス */}
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
            status === "loading" ? "bg-gray-50 text-gray-600" :
            status === "done"    ? "bg-green-50 text-green-700" :
            status === "error"   ? "bg-red-50 text-red-600" : "bg-gray-50"
          }`}>
            {status === "loading" && <Loader2 size={14} className="animate-spin shrink-0" />}
            {status === "done"    && <CheckCircle size={14} className="shrink-0" />}
            {status === "error"   && <AlertCircle size={14} className="shrink-0" />}
            <span>{message}</span>
          </div>

          {/* デバッグ情報（開発/確認用） */}
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
        </div>
      )}

      {/* 注意書き */}
      <p className="text-[10px] text-gray-400 leading-relaxed">
        ※ 画像はブラウザ内で処理されサーバーに送信されません。精度は100%ではないため、適用後に内容をご確認ください。
      </p>
    </div>
  );
}
