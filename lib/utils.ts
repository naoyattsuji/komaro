import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getHeatmapColor(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "bg-white";
  const ratio = count / maxCount;
  if (ratio <= 0.25) return "bg-gray-100";
  if (ratio <= 0.5) return "bg-gray-200";
  if (ratio <= 0.75) return "bg-gray-400";
  if (ratio < 1) return "bg-gray-600";
  return "bg-red-600";
}

export function getHeatmapTextColor(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return "text-gray-300";
  const ratio = count / maxCount;
  if (ratio <= 0.4) return "text-gray-700";
  return "text-white";
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export function getBaseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  return "http://localhost:3000";
}

export function getParticipantUrl(eventId: string): string {
  return `${getBaseUrl()}/e/${eventId}`;
}

export function getEditUrl(eventId: string, editToken: string): string {
  return `${getBaseUrl()}/e/${eventId}/edit?token=${editToken}`;
}

// ─── Calendar export utilities ───────────────────────────────────────────────

export interface CalendarEventParams {
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  description?: string;
}

function toIcsDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

/** Parse "5/1(金)" or "5/1" → Date (current year). Returns null if unparseable. */
export function parseColLabelToDate(colLabel: string): Date | null {
  const m = colLabel.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const year = new Date().getFullYear();
  return new Date(year, parseInt(m[1]) - 1, parseInt(m[2]));
}

/** Parse "09:00" → minutes from midnight. Returns null if unparseable. */
function parseTimeString(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

/** Build start/end Date from a base date + time strings (e.g. "09:00", "10:40"). */
export function buildDateRange(
  base: Date,
  startTime: string | undefined,
  endTime: string | undefined
): { start: Date; end: Date } | null {
  if (!startTime) return null;
  const sm = parseTimeString(startTime);
  if (sm === null) return null;
  const start = new Date(base);
  start.setHours(Math.floor(sm / 60), sm % 60, 0, 0);
  let end: Date;
  if (endTime) {
    const em = parseTimeString(endTime);
    if (em !== null) {
      end = new Date(base);
      end.setHours(Math.floor(em / 60), em % 60, 0, 0);
    } else {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
  } else {
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }
  return { start, end };
}

export function buildGoogleCalendarUrl(p: CalendarEventParams): string {
  const text = encodeURIComponent(p.title);
  const dates =
    p.startDate && p.endDate
      ? `&dates=${toIcsDateTime(p.startDate)}/${toIcsDateTime(p.endDate)}`
      : "";
  const details = p.description ? `&details=${encodeURIComponent(p.description)}` : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}${dates}${details}`;
}

export function buildYahooCalendarUrl(p: CalendarEventParams): string {
  const title = encodeURIComponent(p.title);
  const st = p.startDate ? `&st=${toIcsDateTime(p.startDate)}` : "";
  const et = p.endDate ? `&et=${toIcsDateTime(p.endDate)}` : "";
  const desc = p.description ? `&desc=${encodeURIComponent(p.description)}` : "";
  return `https://calendar.yahoo.co.jp/?v=60&view=d&type=20&title=${title}${st}${et}${desc}`;
}

export function buildOutlookUrl(p: CalendarEventParams): string {
  const subject = encodeURIComponent(p.title);
  const start = p.startDate ? `&startdt=${p.startDate.toISOString()}` : "";
  const end = p.endDate ? `&enddt=${p.endDate.toISOString()}` : "";
  const body = p.description ? `&body=${encodeURIComponent(p.description)}` : "";
  return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${subject}${start}${end}${body}`;
}

export function generateIcsContent(p: CalendarEventParams): string {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@routine`;
  const now = toIcsDateTime(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Routine//Routine//JA",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    p.startDate ? `DTSTART:${toIcsDateTime(p.startDate)}` : null,
    p.endDate ? `DTEND:${toIcsDateTime(p.endDate)}` : null,
    `SUMMARY:${p.title.replace(/[\\;,]/g, "\\$&").replace(/\n/g, "\\n")}`,
    p.description
      ? `DESCRIPTION:${p.description.replace(/[\\;,]/g, "\\$&").replace(/\n/g, "\\n")}`
      : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return lines;
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
