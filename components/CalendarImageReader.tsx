"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, X, Loader2, CheckCircle, AlertCircle, Send, ChevronDown, ChevronUp } from "lucide-react";

interface CalendarImageReaderProps {
  rowLabels: string[];
  colLabels: string[];
  onDetected: (availableCells: Set<string>) => void;
}

// ステータス型
type Status = "idle" | "ocr" | "recognized" | "analyzing" | "done" | "error";

// ──────────────────────────────────────────────
// 画像をリサイズして base64 に変換（Gemini 用）
// ──────────────────────────────────────────────
async function compressImage(
  file: File,
  maxWidth = 1600
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const base64 = canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
      resolve({ base64, mimeType: "image/jpeg" });
    };
    img.src = url;
  });
}

// ──────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────
export function CalendarImageReader({ rowLabels, colLabels, onDetected }: CalendarImageReaderProps) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [eventText, setEventText] = useState("");         // Gemini が出力したテキスト（編集可能）
  const [detectedCount, setDetectedCount] = useState(0);
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  const [showDebug, setShowDebug] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── STEP 1: 画像 → Gemini Vision → 予定テキスト ──
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("画像ファイルを選択してください");
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setStatus("ocr");
    setMessage("AIが画像からカレンダーを読み取り中...");
    setEventText("");
    setDebugLines([]);

    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await fetch("/api/v1/ai/parse-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, rowLabels, colLabels }),
      });

      if (res.status === 503) {
        setStatus("error");
        setMessage("AI機能が設定されていません。");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setMessage("画像の読み取りに失敗しました。別の画像をお試しください。");
        return;
      }

      const data = await res.json();
      const text: string = data.eventText ?? "予定なし";

      setEventText(text);
      setStatus("recognized");
      setMessage("読み取り内容を確認・修正してから「この内容でコマを選択」を押してください");
    } catch {
      setStatus("error");
      setMessage("読み取り中にエラーが発生しました。別の画像をお試しください。");
    }
  }, [rowLabels, colLabels]);

  // ── STEP 2: テキスト → parse-voice API → セル選択 ──
  const handleAnalyze = useCallback(async () => {
    const text = eventText.trim();
    if (!text) return;

    setStatus("analyzing");
    setMessage("テキストを解析してコマを選択中...");

    try {
      const res = await fetch("/api/v1/ai/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, rowLabels, colLabels }),
      });

      if (!res.ok) {
        setStatus("error");
        setMessage("解析に失敗しました。テキストを修正してもう一度お試しください。");
        return;
      }

      const data = await res.json();
      if (!Array.isArray(data.availableCells)) {
        setStatus("error");
        setMessage("解析結果を取得できませんでした。");
        return;
      }

      const available = new Set<string>();
      for (const { row, col } of data.availableCells as { row: number; col: number }[]) {
        if (row >= 0 && row < rowLabels.length && col >= 0 && col < colLabels.length) {
          available.add(`${row}-${col}`);
        }
      }

      const interpretation = data.interpretation ?? "";
      const reasoning = data.reasoning ?? "";
      setDebugLines([
        `✨ AI解釈: ${interpretation}`,
        ...(reasoning ? [`　推論: ${reasoning}`] : []),
      ]);
      setShowDebug(true);
      setPendingCells(available);
      setDetectedCount(available.size);

      if (available.size === 0) {
        setStatus("error");
        setMessage("空きコマが見つかりませんでした。読み取りテキストを編集してもう一度お試しください。");
      } else {
        setStatus("done");
        setMessage(`${available.size}コマの空き時間を検出しました`);
      }
    } catch {
      setStatus("error");
      setMessage("解析中にエラーが発生しました。");
    }
  }, [eventText, rowLabels, colLabels]);

  const handleApply = () => {
    onDetected(pendingCells);
    setOpen(false);
    reset();
  };

  const reset = () => {
    setImageUrl(null);
    setStatus("idle");
    setMessage("");
    setEventText("");
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
          <span className="text-sm font-medium text-gray-800">スクショから自動入力（β）</span>
        </div>
        <button type="button" onClick={() => { setOpen(false); reset(); }} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* ── STEP 1: 画像アップロード ── */}
      {status === "idle" && (
        <>
          <p className="text-xs text-gray-500 leading-relaxed">
            カレンダーアプリのスクリーンショットをアップロードすると、予定を読み取って空き時間を自動で検出します。
          </p>
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
        </>
      )}

      {/* ── STEP 1: OCR 処理中 ── */}
      {status === "ocr" && (
        <>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="カレンダープレビュー" className="w-full max-h-40 object-contain rounded-lg border border-gray-100" />
          )}
          <div className="flex items-center gap-2 text-sm bg-gray-50 text-gray-600 rounded-lg px-3 py-2">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span>{message}</span>
          </div>
        </>
      )}

      {/* ── STEP 2: テキスト確認・編集 ── */}
      {status === "recognized" && (
        <>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="カレンダープレビュー" className="w-full max-h-40 object-contain rounded-lg border border-gray-100" />
          )}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-700">
              AIが読み取った予定{" "}
              <span className="text-gray-400 font-normal">— 間違いがあれば修正してください</span>
            </p>
            <textarea
              value={eventText}
              onChange={(e) => setEventText(e.target.value)}
              rows={4}
              className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              placeholder="例: 月曜日の10時から12時に会議があります。火曜日は終日予定が入っています。"
            />
            <p className="text-[10px] text-gray-400">
              ヒント:「予定なし」と入力すると全コマが空きになります
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
            >
              画像を撮り直す
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!eventText.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg py-2 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={13} />
              この内容でコマを選択
            </button>
          </div>
        </>
      )}

      {/* ── STEP 3: 解析中 ── */}
      {status === "analyzing" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <svg className="animate-spin w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-sm text-gray-600">テキストを解析中...</p>
        </div>
      )}

      {/* ── STEP 4: 結果 ── */}
      {(status === "done" || (status === "error" && debugLines.length > 0)) && (
        <>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="カレンダープレビュー" className="w-full max-h-40 object-contain rounded-lg border border-gray-100" />
          )}
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
            status === "done" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {status === "done"  && <CheckCircle size={14} className="shrink-0" />}
            {status === "error" && <AlertCircle size={14} className="shrink-0" />}
            <span>{message}</span>
          </div>

          {debugLines.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowDebug(!showDebug)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                解析の詳細
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
            {status === "error" && eventText && (
              <button type="button" onClick={() => setStatus("recognized")} className="flex-1 text-sm font-medium text-white bg-gray-700 rounded-lg py-2 hover:bg-gray-600 transition-colors">
                テキストを編集する
              </button>
            )}
          </div>
        </>
      )}

      {/* エラー（テキスト確認前） */}
      {status === "error" && debugLines.length === 0 && message && (
        <>
          <div className="flex items-start gap-2 text-sm bg-red-50 text-red-600 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
          <button type="button" onClick={reset} className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors">
            やり直す
          </button>
        </>
      )}

      <p className="text-[10px] text-gray-400 leading-relaxed">
        ※ 画像はサーバーに送信され AI で解析されます。送信した画像は解析後に破棄されます。
      </p>
    </div>
  );
}
