"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Send } from "lucide-react";
import { parseTimeToMinutes } from "@/lib/utils";

interface VoiceInputReaderProps {
  rowLabels: string[];
  colLabels: string[];
  onDetected: (availableCells: Set<string>) => void;
}

// Web Speech API は TypeScript 標準型に含まれないため any で扱う
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

// ステータス型
type Status = "idle" | "listening" | "recognized" | "loading" | "done" | "error";

// 曜日パターン（長いものから先に照合して誤マッチを防ぐ）
const DAY_PATTERNS: { keywords: string[]; dayChar: string }[] = [
  { keywords: ["月曜日", "月曜", "月"], dayChar: "月" },
  { keywords: ["火曜日", "火曜", "火"], dayChar: "火" },
  { keywords: ["水曜日", "水曜", "水"], dayChar: "水" },
  { keywords: ["木曜日", "木曜", "木"], dayChar: "木" },
  { keywords: ["金曜日", "金曜", "金"], dayChar: "金" },
  { keywords: ["土曜日", "土曜", "土"], dayChar: "土" },
  { keywords: ["日曜日", "日曜", "日"], dayChar: "日" },
];

function labelMatchesDay(label: string, dayChar: string): boolean {
  return (
    label.includes(`(${dayChar})`) ||
    label.includes(`${dayChar}曜`) ||
    label === dayChar
  );
}

function parseRowMinutes(label: string): number | null {
  const direct = parseTimeToMinutes(label);
  if (direct !== null) return direct;
  const rangeStart = label.match(/^(\d{1,2}:\d{2})/);
  if (rangeStart) return parseTimeToMinutes(rangeStart[1]);
  return null;
}

// ──────────────────────────────────────────────
// 音声テキストから空きコマを解析するコアロジック（フォールバック用）
// ──────────────────────────────────────────────
function parseVoiceText(
  text: string,
  rowLabels: string[],
  colLabels: string[]
): { available: Set<string>; debug: string[] } {
  const debug: string[] = [];
  debug.push(`認識テキスト: 「${text}」`);

  const busyPhrases = [
    "予定がある", "予定あり", "予定が入", "埋まって", "埋まり",
    "できない", "無理", "NG", "だめ", "ダメ", "行けない", "参加できない",
  ];
  const isBusy = busyPhrases.some((kw) => text.includes(kw));
  debug.push(`判定: ${isBusy ? "予定あり（busy）" : "空き（available）"}`);

  // 「X以外」「Xを除く」の除外曜日を先に抽出（文全体から）
  const excludedColIndices = new Set<number>();
  for (const { keywords, dayChar } of DAY_PATTERNS) {
    const hasExclude = keywords.some(
      (kw) =>
        text.includes(`${kw}以外`) ||
        text.includes(`${kw}を除`) ||
        text.includes(`${kw}除いて`)
    );
    if (hasExclude) {
      colLabels.forEach((label, ci) => {
        if (labelMatchesDay(label, dayChar)) excludedColIndices.add(ci);
      });
    }
  }

  const hasAllKeyword =
    text.includes("全部") ||
    text.includes("全て") ||
    text.includes("すべて") ||
    text.includes("毎日");

  const mentionedColIndices = new Set<number>();

  if (hasAllKeyword) {
    // 全列から除外分を引く
    colLabels.forEach((_, ci) => {
      if (!excludedColIndices.has(ci)) mentionedColIndices.add(ci);
    });
    debug.push(
      excludedColIndices.size > 0
        ? `全列対象（除外: ${Array.from(excludedColIndices).map((ci) => colLabels[ci]).join(", ")}）`
        : "全列を対象"
    );
  } else {
    for (const { keywords, dayChar } of DAY_PATTERNS) {
      if (keywords.some((kw) => text.includes(kw))) {
        colLabels.forEach((label, ci) => {
          if (labelMatchesDay(label, dayChar) && !excludedColIndices.has(ci))
            mentionedColIndices.add(ci);
        });
      }
    }

    for (const m of text.matchAll(/(\d{1,2})[/月](\d{1,2})日?/g)) {
      const dateStr = `${m[1]}/${m[2]}`;
      colLabels.forEach((label, ci) => {
        if (label.startsWith(dateStr)) mentionedColIndices.add(ci);
      });
    }

    if (mentionedColIndices.size === 0) {
      colLabels.forEach((_, ci) => {
        if (!excludedColIndices.has(ci)) mentionedColIndices.add(ci);
      });
      debug.push("曜日指定なし → 全列対象");
    }
  }

  const mentionedCols = Array.from(mentionedColIndices);
  debug.push(`対象列: ${mentionedCols.map((ci) => colLabels[ci]).join(", ")}`);

  let startMinutes: number | null = null;
  let endMinutes: number | null = null;

  const rangeMatch = text.match(
    /(\d{1,2}(?::\d{2})?)時?から(\d{1,2}(?::\d{2})?)時?/
  );
  if (rangeMatch) {
    startMinutes = parseTimeToMinutes(rangeMatch[1]);
    endMinutes = parseTimeToMinutes(rangeMatch[2]);
    debug.push(`時間範囲: ${rangeMatch[1]}〜${rangeMatch[2]}`);
  } else {
    if (text.includes("午前中")) {
      startMinutes = 6 * 60; endMinutes = 12 * 60;
    } else if (text.includes("午後")) {
      startMinutes = 12 * 60; endMinutes = 19 * 60;
    } else if (text.includes("夕方")) {
      startMinutes = 17 * 60; endMinutes = 21 * 60;
    } else if (text.includes("夜")) {
      startMinutes = 19 * 60; endMinutes = 24 * 60;
    } else if (text.includes("朝")) {
      startMinutes = 6 * 60; endMinutes = 10 * 60;
    } else if (text.includes("昼")) {
      startMinutes = 11 * 60; endMinutes = 14 * 60;
    }

    if (startMinutes === null) {
      const singleMatch = text.match(/(\d{1,2}(?::\d{2})?)時/);
      if (singleMatch) {
        startMinutes = parseTimeToMinutes(singleMatch[1]);
        endMinutes = startMinutes !== null ? startMinutes + 60 : null;
      }
    }
  }

  if (startMinutes === null) {
    debug.push("時間指定なし → 全行対象");
  }

  const available = new Set<string>();

  if (!isBusy) {
    for (const ci of mentionedCols) {
      for (let ri = 0; ri < rowLabels.length; ri++) {
        if (startMinutes === null) {
          available.add(`${ri}-${ci}`);
          continue;
        }
        const rowMinutes = parseRowMinutes(rowLabels[ri]);
        if (rowMinutes === null) continue;

        const inRange =
          endMinutes !== null
            ? rowMinutes >= startMinutes && rowMinutes < endMinutes
            : Math.abs(rowMinutes - startMinutes) < 60;

        if (inRange) available.add(`${ri}-${ci}`);
      }
    }
  }

  debug.push(`選択されたコマ数: ${available.size}`);
  return { available, debug };
}

// ──────────────────────────────────────────────
// Gemini API でパース → フォールバックで正規表現
// ──────────────────────────────────────────────
async function parseWithGeminiOrFallback(
  transcript: string,
  rowLabels: string[],
  colLabels: string[]
): Promise<{ cells: Set<string>; debugLines: string[]; ok: boolean }> {
  try {
    const res = await fetch("/api/v1/ai/parse-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, rowLabels, colLabels }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.availableCells)) {
        const available = new Set<string>();
        for (const { row, col } of data.availableCells as { row: number; col: number }[]) {
          if (row >= 0 && row < rowLabels.length && col >= 0 && col < colLabels.length) {
            available.add(`${row}-${col}`);
          }
        }
        const interpretation = data.interpretation ?? "";
        const reasoning = data.reasoning ?? "";
        const debugLines = [
          `✨ AI解釈: ${interpretation}`,
          ...(reasoning ? [`　推論: ${reasoning}`] : []),
        ];
        return { cells: available, debugLines, ok: true };
      }
    }
  } catch {
    // フォールバックへ
  }

  const { available, debug } = parseVoiceText(transcript, rowLabels, colLabels);
  return {
    cells: available,
    debugLines: ["⚙️ ローカル解析（フォールバック）", ...debug],
    ok: available.size > 0,
  };
}

// ──────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────
export function VoiceInputReader({
  rowLabels,
  colLabels,
  onDetected,
}: VoiceInputReaderProps) {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [editableTranscript, setEditableTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  const [detectedCount, setDetectedCount] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const recognitionRef = useRef<AnySpeechRecognition>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const ok =
      typeof window !== "undefined" &&
      !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    setSupported(ok);
  }, []);

  // 確定テキストを蓄積するための ref（continuous=true では onresult が複数回発火する）
  const finalTranscriptRef = useRef("");

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    finalTranscriptRef.current = "";

    const recognition = new SR();
    recognition.lang = "ja-JP";
    recognition.continuous = true;      // 無音でも自動停止しない
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setListening(true);
      setStatus("listening");
      setMessage("話しかけてください。終わったら停止ボタンを押してください");
      setTranscript("");
      setEditableTranscript("");
      setInterimTranscript("");
      setPendingCells(new Set());
      setDebugLines([]);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          // 確定テキストを蓄積
          finalTranscriptRef.current += r[0].transcript;
          setTranscript(finalTranscriptRef.current);
        } else {
          interim += r[0].transcript;
        }
      }
      setInterimTranscript(interim);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setListening(false);
      setStatus("error");
      switch (event.error) {
        case "not-allowed":
        case "permission-denied":
          setMessage("マイクへのアクセスが拒否されました。ブラウザのアドレスバー横の🔒マークからマイクを許可してください。");
          break;
        case "no-speech":
          setMessage("音声が検出されませんでした。もう少し大きな声でお試しください。");
          break;
        case "network":
          setMessage("ネットワークエラーが発生しました。インターネット接続を確認してください（Chrome は音声認識にネット接続が必要です）。");
          break;
        case "audio-capture":
          setMessage("マイクが見つかりません。デバイスにマイクが接続されているか確認してください。");
          break;
        case "service-not-allowed":
          setMessage("このブラウザ・環境では音声入力が許可されていません。Chrome をお試しください。");
          break;
        default:
          setMessage(`音声認識エラー: ${event.error} — Chrome または Edge でお試しください。`);
      }
    };

    recognition.onend = () => {
      setListening(false);
      const accumulated = finalTranscriptRef.current.trim();
      if (accumulated) {
        // 蓄積されたテキストがあれば確認ステップへ
        setEditableTranscript(accumulated);
        setInterimTranscript("");
        setStatus("recognized");
        setMessage("テキストを確認・修正してから「解析する」を押してください");
      } else {
        setStatus((prev) => {
          if (prev === "listening") {
            setMessage("音声を認識できませんでした。ボタンを押してからすぐに話してください。");
            return "error";
          }
          return prev;
        });
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setStatus("error");
      setMessage("音声入力を開始できませんでした。ページを再読み込みしてもう一度お試しください。");
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  // 確認ステップ後に AI 解析を実行
  const handleAnalyze = useCallback(async () => {
    const text = editableTranscript.trim();
    if (!text) return;
    setStatus("loading");
    setMessage("AIで解析中...");
    const { cells, debugLines: dl } = await parseWithGeminiOrFallback(text, rowLabels, colLabels);
    setDebugLines(dl);
    setPendingCells(cells);
    setDetectedCount(cells.size);
    if (cells.size === 0) {
      setStatus("error");
      setMessage("空き時間を検出できませんでした。テキストを編集してもう一度試してください。");
    } else {
      setStatus("done");
      setMessage(`${cells.size}コマの空き時間を検出しました`);
    }
  }, [editableTranscript, rowLabels, colLabels]);

  const handleApply = () => {
    onDetected(pendingCells);
    setOpen(false);
    reset();
  };

  const reset = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    finalTranscriptRef.current = "";
    setListening(false);
    setTranscript("");
    setEditableTranscript("");
    setInterimTranscript("");
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
        <Mic size={12} />
        音声から自動入力（β）
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic size={15} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-800">音声から自動入力（β）</span>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(false); reset(); }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      {/* ブラウザ非対応 */}
      {!supported ? (
        <div className="bg-red-50 rounded-lg px-3 py-2 text-sm text-red-600">
          お使いのブラウザは音声入力に対応していません。Chrome または Edge をお試しください。
        </div>
      ) : (
        <>
          {/* ── ステップ1: 録音 ── */}
          {(status === "idle" || status === "listening" || status === "error") && (
            <>
              <p className="text-xs text-gray-500 leading-relaxed">
                空いている時間を話してください。<br />
                例:「月曜の10時から12時は空いてます」「水曜日は全部大丈夫です」
              </p>

              <div className="flex flex-col items-center gap-2 py-3">
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md ${
                    listening
                      ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-red-200"
                      : "bg-gray-900 hover:bg-gray-700"
                  }`}
                >
                  {listening ? (
                    <MicOff size={24} className="text-white" />
                  ) : (
                    <Mic size={24} className="text-white" />
                  )}
                </button>
                <p className="text-xs text-gray-500">
                  {listening ? "録音中 — タップして停止" : "タップして録音開始"}
                </p>
              </div>

              {/* 録音中の途中テキスト */}
              {interimTranscript && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-gray-400 mb-1">認識中...</p>
                  <p className="text-sm text-gray-400 italic">{interimTranscript}</p>
                </div>
              )}
            </>
          )}

          {/* ── ステップ2: テキスト確認・編集 ── */}
          {status === "recognized" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1.5">
                  認識されたテキスト <span className="text-gray-400 font-normal">— 間違いがあれば修正してください</span>
                </p>
                <textarea
                  value={editableTranscript}
                  onChange={(e) => setEditableTranscript(e.target.value)}
                  rows={3}
                  className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="例: 月曜の10時から12時は空いてます"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  ヒント:「月曜の午後は空いてます」「火曜以外は全部OK」のように自然な日本語でもOK
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setStatus("idle"); setEditableTranscript(""); setTranscript(""); }}
                  className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2 hover:bg-gray-50 transition-colors"
                >
                  録音し直す
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!editableTranscript.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg py-2 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={13} />
                  解析する
                </button>
              </div>
            </div>
          )}

          {/* ── ステップ3: AI解析中 ── */}
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <svg className="animate-spin w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-sm text-gray-600">AIで解析中...</p>
              {transcript && (
                <p className="text-xs text-gray-400 text-center">「{editableTranscript}」</p>
              )}
            </div>
          )}

          {/* ── ステップ4: 結果 ── */}
          {(status === "done" || (status === "error" && debugLines.length > 0)) && (
            <>
              {/* ステータス */}
              {message && (
                <div
                  className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                    status === "done"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {status === "done"  && <CheckCircle size={14} className="shrink-0" />}
                  {status === "error" && <AlertCircle size={14} className="shrink-0" />}
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
                    解析の詳細
                  </button>
                  {showDebug && (
                    <div className="mt-1 bg-gray-50 rounded p-2 space-y-0.5">
                      {debugLines.map((l, i) => (
                        <p key={i} className="text-[10px] text-gray-500 font-mono">
                          {l}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* エラー（テキスト確認前）*/}
          {status === "error" && debugLines.length === 0 && message && (
            <div className="flex items-start gap-2 text-sm bg-red-50 text-red-600 rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* アクションボタン */}
          {(status === "done" || status === "error") && (
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
              {status === "error" && editableTranscript && (
                <button
                  type="button"
                  onClick={() => setStatus("recognized")}
                  className="flex-1 text-sm font-medium text-white bg-gray-700 rounded-lg py-2 hover:bg-gray-600 transition-colors"
                >
                  テキストを編集する
                </button>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-gray-400 leading-relaxed">
        ※ Chrome利用時は音声がGoogleのサーバーに送信されます。Chrome・Edgeでの利用を推奨します。
      </p>
    </div>
  );
}
