"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { parseTimeToMinutes } from "@/lib/utils";

interface VoiceInputReaderProps {
  rowLabels: string[];
  colLabels: string[];
  onDetected: (availableCells: Set<string>) => void;
}

// Web Speech API は TypeScript 標準型に含まれないため any で扱う
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

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

/**
 * 列ラベルが指定の曜日を表しているか判定。
 * "5/7(月)" "(月)" "月曜" "月曜日" "月" など多様な形式に対応。
 */
function labelMatchesDay(label: string, dayChar: string): boolean {
  return (
    label.includes(`(${dayChar})`) ||   // "5/7(月)", "(月)"
    label.includes(`${dayChar}曜`) ||    // "月曜", "月曜日"
    label === dayChar                    // ラベルがそのまま "月"
  );
}

/**
 * 行ラベルから開始時刻（分）を取得。
 * "10:00" "10時" "10:00〜12:00" "10:00-12:00" などに対応。
 */
function parseRowMinutes(label: string): number | null {
  // そのまま試す
  const direct = parseTimeToMinutes(label);
  if (direct !== null) return direct;
  // 範囲表記から先頭の時刻を取り出す ("10:00〜12:00" → "10:00")
  const rangeStart = label.match(/^(\d{1,2}:\d{2})/);
  if (rangeStart) return parseTimeToMinutes(rangeStart[1]);
  return null;
}

// ──────────────────────────────────────────────
// 音声テキストから空きコマを解析するコアロジック
// ──────────────────────────────────────────────
function parseVoiceText(
  text: string,
  rowLabels: string[],
  colLabels: string[]
): { available: Set<string>; debug: string[] } {
  const debug: string[] = [];
  debug.push(`認識テキスト: 「${text}」`);

  // ── ① 空き or 予定あり を判定 ──
  const busyPhrases = [
    "予定がある", "予定あり", "予定が入", "埋まって", "埋まり",
    "できない", "無理", "NG", "だめ", "ダメ", "行けない", "参加できない",
  ];
  const isBusy = busyPhrases.some((kw) => text.includes(kw));
  debug.push(`判定: ${isBusy ? "予定あり（busy）" : "空き（available）"}`);

  // ── ② 対象列（曜日・日付）を特定 ──
  const mentionedColIndices = new Set<number>();

  if (
    text.includes("全部") ||
    text.includes("全て") ||
    text.includes("すべて") ||
    text.includes("毎日")
  ) {
    colLabels.forEach((_, ci) => mentionedColIndices.add(ci));
    debug.push("全列を対象");
  } else {
    // 曜日キーワードで照合
    for (const { keywords, dayChar } of DAY_PATTERNS) {
      if (keywords.some((kw) => text.includes(kw))) {
        colLabels.forEach((label, ci) => {
          if (labelMatchesDay(label, dayChar)) mentionedColIndices.add(ci);
        });
      }
    }

    // 日付パターン「5/7」「5月7日」で照合
    for (const m of text.matchAll(/(\d{1,2})[/月](\d{1,2})日?/g)) {
      const dateStr = `${m[1]}/${m[2]}`;
      colLabels.forEach((label, ci) => {
        if (label.startsWith(dateStr)) mentionedColIndices.add(ci);
      });
    }

    // 曜日・日付の指定がなければ全列対象
    if (mentionedColIndices.size === 0) {
      colLabels.forEach((_, ci) => mentionedColIndices.add(ci));
      debug.push("曜日指定なし → 全列対象");
    }
  }

  const mentionedCols = Array.from(mentionedColIndices);
  debug.push(`対象列: ${mentionedCols.map((ci) => colLabels[ci]).join(", ")}`);

  // ── ③ 時間範囲を解析 ──
  let startMinutes: number | null = null;
  let endMinutes: number | null = null;

  // 「10時から12時」「10:00から12:00まで」
  const rangeMatch = text.match(
    /(\d{1,2}(?::\d{2})?)時?から(\d{1,2}(?::\d{2})?)時?/
  );
  if (rangeMatch) {
    startMinutes = parseTimeToMinutes(rangeMatch[1]);
    endMinutes = parseTimeToMinutes(rangeMatch[2]);
    debug.push(`時間範囲: ${rangeMatch[1]}〜${rangeMatch[2]}`);
  } else {
    // 時間帯キーワード
    if (text.includes("午前中")) {
      startMinutes = 6 * 60; endMinutes = 12 * 60;
      debug.push("午前中 → 6:00〜12:00");
    } else if (text.includes("午後")) {
      startMinutes = 12 * 60; endMinutes = 19 * 60;
      debug.push("午後 → 12:00〜19:00");
    } else if (text.includes("夕方")) {
      startMinutes = 17 * 60; endMinutes = 21 * 60;
      debug.push("夕方 → 17:00〜21:00");
    } else if (text.includes("夜")) {
      startMinutes = 19 * 60; endMinutes = 24 * 60;
      debug.push("夜 → 19:00〜24:00");
    } else if (text.includes("朝")) {
      startMinutes = 6 * 60; endMinutes = 10 * 60;
      debug.push("朝 → 6:00〜10:00");
    } else if (text.includes("昼")) {
      startMinutes = 11 * 60; endMinutes = 14 * 60;
      debug.push("昼 → 11:00〜14:00");
    }

    // 「〜時」単体（範囲が見つからなかった場合）
    if (startMinutes === null) {
      const singleMatch = text.match(/(\d{1,2}(?::\d{2})?)時/);
      if (singleMatch) {
        startMinutes = parseTimeToMinutes(singleMatch[1]);
        endMinutes = startMinutes !== null ? startMinutes + 60 : null;
        debug.push(`単一時刻: ${singleMatch[1]}時`);
      }
    }
  }

  if (startMinutes === null) {
    debug.push("時間指定なし → 全行対象");
  }

  // ── ④ コマを選択 ──
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

  // 行ラベルのパース結果をデバッグ出力
  debug.push(`行ラベル解析: ${rowLabels.map((l) => `${l}→${parseRowMinutes(l) ?? "null"}`).join(", ")}`);
  debug.push(`選択されたコマ数: ${available.size}`);
  return { available, debug };
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
  const [status, setStatus] = useState<"idle" | "listening" | "done" | "error">("idle");
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

  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "ja-JP";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setListening(true);
      setStatus("listening");
      setMessage("話しかけてください...");
      setTranscript("");
      setPendingCells(new Set());
      setDebugLines([]);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        (r.isFinal ? (final += r[0].transcript) : (interim += r[0].transcript));
      }
      setTranscript(final || interim);

      if (final) {
        const { available, debug } = parseVoiceText(final, rowLabels, colLabels);
        setDebugLines(debug);
        setPendingCells(available);
        setDetectedCount(available.size);
        if (available.size === 0) {
          setStatus("error");
          setMessage(
            "空き時間を検出できませんでした。「月曜の10時から12時は空いてます」のように話してみてください。"
          );
        } else {
          setStatus("done");
          setMessage(`${available.size}コマの空き時間を検出しました`);
        }
      }
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
      // 結果なしで終了した場合（沈黙タイムアウト等）にエラーを表示
      setStatus((prev) => {
        if (prev === "listening") {
          setMessage("音声を認識できませんでした。ボタンを押してからすぐに話してください。");
          return "error";
        }
        return prev;
      });
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setStatus("error");
      setMessage("音声入力を開始できませんでした。ページを再読み込みしてもう一度お試しください。");
    }
  }, [rowLabels, colLabels]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const handleApply = () => {
    onDetected(pendingCells);
    setOpen(false);
    reset();
  };

  const reset = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setTranscript("");
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
          <p className="text-xs text-gray-500 leading-relaxed">
            空いている時間を話してください。<br />
            例:「月曜の10時から12時は空いてます」「水曜日は全部大丈夫です」
          </p>

          {/* マイクボタン */}
          <div className="flex flex-col items-center gap-2 py-3">
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={status === "done"}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md ${
                listening
                  ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-red-200"
                  : status === "done"
                  ? "bg-gray-200 cursor-not-allowed"
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
              {listening
                ? "録音中 — タップして停止"
                : status === "done"
                ? "認識完了"
                : "タップして録音開始"}
            </p>
          </div>

          {/* 認識テキスト表示 */}
          {transcript && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400 mb-1">認識テキスト</p>
              <p className="text-sm text-gray-700">{transcript}</p>
            </div>
          )}

          {/* ステータス */}
          {message && (
            <div
              className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                status === "listening"
                  ? "bg-gray-50 text-gray-600"
                  : status === "done"
                  ? "bg-green-50 text-green-700"
                  : status === "error"
                  ? "bg-red-50 text-red-600"
                  : "bg-gray-50"
              }`}
            >
              {status === "done" && <CheckCircle size={14} className="shrink-0" />}
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
                読み取り詳細
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
        </>
      )}

      <p className="text-[10px] text-gray-400 leading-relaxed">
        ※ Chrome利用時は音声がGoogleのサーバーに送信されます。Chrome・Edgeでの利用を推奨します。
      </p>
    </div>
  );
}
