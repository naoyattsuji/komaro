"use client";

import { useState } from "react";
import { Copy, Check, Download, ExternalLink } from "lucide-react";
import {
  CalendarEventParams,
  buildShortCalendarUrl,
  generateIcsContent,
  downloadIcs,
} from "@/lib/utils";

interface CalendarExportProps {
  params: CalendarEventParams;
  /** 一括コピー用テキスト（タイトル・日時・参加者など） */
  copyText: string;
}

export function CalendarExport({ params, copyText }: CalendarExportProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = copyText;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleIcs = () => {
    const content = generateIcsContent(params);
    downloadIcs(params.title, content);
  };

  return (
    <div className="space-y-3">
      {/* Calendar URL buttons */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        カレンダーに追加
      </p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={buildShortCalendarUrl("google", params)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ExternalLink size={12} className="text-[#4285F4]" />
          Google
        </a>
        <a
          href={buildShortCalendarUrl("yahoo", params)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ExternalLink size={12} className="text-[#FF0033]" />
          Yahoo
        </a>
        <a
          href={buildShortCalendarUrl("outlook", params)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ExternalLink size={12} className="text-[#0078D4]" />
          Outlook
        </a>
        <button
          type="button"
          onClick={handleIcs}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download size={12} className="text-gray-500" />
          Apple・その他
        </button>
      </div>

      {/* Copy all button */}
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          copied
            ? "bg-gray-900 text-white border border-gray-900"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent"
        }`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "コピーしました" : "内容を一括コピー"}
      </button>
    </div>
  );
}
