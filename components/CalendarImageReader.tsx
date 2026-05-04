"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, X, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { parseTimeToMinutes } from "@/lib/utils";

interface CalendarImageReaderProps {
  rowLabels: string[];
  colLabels: string[];
  onDetected: (availableCells: Set<string>) => void;
}

interface Word {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

// ──────────────────────────────────────────────
// 画像をリサイズして base64 に変換（Gemini 用）
// ──────────────────────────────────────────────
async function compressImage(
  file: File,
  maxWidth = 1600   // 解像度を上げて文字を読みやすく
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // 元画像が小さければ拡大しない（ぼけるだけ）
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      // スムージング有効（縮小時に品質向上）
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      // 品質を上げる (0.92)
      const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.src = url;
  });
}

// ──────────────────────────────────────────────
// Gemini Vision でカレンダーを解析
// ──────────────────────────────────────────────
async function analyzeWithGemini(
  file: File,
  rowLabels: string[],
  colLabels: string[]
): Promise<Set<string> | null> {
  try {
    const { base64, mimeType } = await compressImage(file);
    const res = await fetch("/api/v1/ai/parse-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mimeType, rowLabels, colLabels }),
    });

    if (res.status === 503) return null; // API キー未設定 → フォールバック
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data.freeCells)) return null;

    const available = new Set<string>();
    for (const { row, col } of data.freeCells as { row: number; col: number }[]) {
      if (row >= 0 && row < rowLabels.length && col >= 0 && col < colLabels.length) {
        available.add(`${row}-${col}`);
      }
    }
    (available as Set<string> & { _debug?: string })._debug =
      `検出した予定: ${data.extractedEvents ?? "?"} 件 / ${data.debug ?? ""}`;
    return available;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Tesseract.js フォールバック（従来ロジック）
// ──────────────────────────────────────────────
function detectAvailableSlots(
  words: Word[],
  rowLabels: string[],
  colLabels: string[]
): { available: Set<string>; debug: string[] } {
  const debug: string[] = [];
  const filtered = words.filter((w) => w.confidence > 40 && w.text.trim().length > 0);

  if (filtered.length === 0) {
    return { available: new Set(), debug: ["テキストを検出できませんでした"] };
  }

  const imgWidth = Math.max(...filtered.map((w) => w.bbox.x1));
  const imgHeight = Math.max(...filtered.map((w) => w.bbox.y1));
  const TIME_COL_LIMIT = imgWidth * 0.25;

  const timeLabels: { minutes: number; y0: number; y1: number }[] = [];
  for (const w of filtered) {
    if (w.bbox.x0 > TIME_COL_LIMIT) continue;
    const m = parseTimeToMinutes(w.text);
    if (m !== null) timeLabels.push({ minutes: m, y0: w.bbox.y0, y1: w.bbox.y1 });
  }
  timeLabels.sort((a, b) => a.y0 - b.y0);
  debug.push(`検出した時刻ラベル: ${timeLabels.map((t) => `${Math.floor(t.minutes / 60)}:${String(t.minutes % 60).padStart(2, "0")}`).join(", ")}`);

  if (timeLabels.length < 2) {
    debug.push("時刻ラベルが2つ未満 → 判定できません");
    return { available: new Set(), debug };
  }

  const slots = timeLabels.map((tl, i) => ({
    minutes: tl.minutes,
    y0: tl.y0,
    y1: i + 1 < timeLabels.length ? timeLabels[i + 1].y0 : imgHeight,
  }));

  const busyMinutes: number[] = [];
  for (const slot of slots) {
    const hasEvent = filtered.some(
      (w) =>
        w.bbox.x0 > TIME_COL_LIMIT &&
        w.bbox.y0 >= slot.y0 - 5 &&
        w.bbox.y0 < slot.y1 - 5 &&
        parseTimeToMinutes(w.text) === null
    );
    if (hasEvent) busyMinutes.push(slot.minutes);
  }

  debug.push(`Busy: ${busyMinutes.map((m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`).join(", ") || "なし"}`);

  const available = new Set<string>();
  for (let ri = 0; ri < rowLabels.length; ri++) {
    const rowMinutes = parseTimeToMinutes(rowLabels[ri]);
    if (rowMinutes === null) continue;
    const isBusy = busyMinutes.some((bm) => Math.abs(bm - rowMinutes) < 60);
    if (!isBusy) {
      for (let ci = 0; ci < colLabels.length; ci++) available.add(`${ri}-${ci}`);
    }
  }
  return { available, debug };
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
    setMessage("AIでカレンダーを解析中...");

    // ── Gemini Vision を試みる ──
    const geminiResult = await analyzeWithGemini(file, rowLabels, colLabels);

    if (geminiResult !== null) {
      setPendingCells(geminiResult);
      setDetectedCount(geminiResult.size);
      const debugNote = (geminiResult as Set<string> & { _debug?: string })._debug ?? "";
      setDebugLines([`✨ Gemini AI で解析しました`, ...(debugNote ? [debugNote] : [])]);
      if (geminiResult.size === 0) {
        setStatus("error");
        setMessage("空き時間を検出できませんでした。別の画像をお試しください。");
      } else {
        setStatus("done");
        setMessage(`${geminiResult.size}コマの空き時間を検出しました`);
      }
      return;
    }

    // ── Tesseract フォールバック ──
    setMessage("OCRで読み取り中...");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["jpn", "eng"], 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setMessage(`OCR読み取り中... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const result = await worker.recognize(file, {}, { blocks: true });
      await worker.terminate();

      const words: Word[] = [];
      for (const block of result.data.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          for (const line of para.lines ?? []) {
            for (const word of line.words ?? []) {
              if (word.text.trim()) {
                words.push({ text: word.text.trim(), bbox: word.bbox, confidence: word.confidence });
              }
            }
          }
        }
      }

      if (words.length === 0) {
        setStatus("error");
        setMessage("テキストを検出できませんでした。より鮮明な画像をお試しください。");
        return;
      }

      const { available, debug } = detectAvailableSlots(words, rowLabels, colLabels);
      setDebugLines(["⚙️ OCR（フォールバック）で解析しました", ...debug]);
      setPendingCells(available);
      setDetectedCount(available.size);

      if (available.size === 0) {
        setStatus("error");
        setMessage("空き時間を検出できませんでした。時間帯ラベルが見えるカレンダーをお試しください。");
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={15} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-800">カレンダーから自動入力（β）</span>
        </div>
        <button type="button" onClick={() => { setOpen(false); reset(); }} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        カレンダーアプリのスクリーンショットをアップロードすると、空き時間を自動で検出します。
      </p>

      {!imageUrl ? (
        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Camera size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">タップして画像を選択</p>
          <p className="text-xs text-gray-400 mt-1">またはドラッグ＆ドロップ</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="カレンダープレビュー" className="w-full max-h-48 object-contain rounded-lg border border-gray-100" />
            {status === "idle" && (
              <button type="button" onClick={reset} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-gray-500 hover:text-gray-700">
                <X size={14} />
              </button>
            )}
          </div>

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

          {debugLines.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowDebug(!showDebug)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                読み取り詳細
              </button>
              {showDebug && (
                <div className="mt-1 bg-gray-50 rounded p-2 space-y-0.5">
                  {debugLines.map((l, i) => <p key={i} className="text-[10px] text-gray-500 font-mono">{l}</p>)}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={reset} className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors">
              やり直す
            </button>
            {status === "done" && (
              <button type="button" onClick={handleApply} className="flex-1 text-sm font-medium text-white bg-gray-900 rounded-lg py-2 hover:bg-gray-700 transition-colors">
                {detectedCount}コマを適用する
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400 leading-relaxed">
        ※ 画像はサーバーに送信され AI で解析されます。送信した画像は解析後に破棄されます。
      </p>
    </div>
  );
}
