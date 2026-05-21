export type RecentEventKind = "created" | "joined" | "viewed";

export interface RecentEvent {
  id: string;
  title: string;
  url: string;
  kind: RecentEventKind;
  updatedAt: string;
}

const STORAGE_KEY = "komaro_recent_events";
const MAX_RECENT_EVENTS = 8;

export function getRecentEvents(): RecentEvent[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentEvent);
  } catch {
    return [];
  }
}

export function rememberRecentEvent(event: {
  id: string;
  title?: string | null;
  url?: string;
  kind: RecentEventKind;
}) {
  if (typeof window === "undefined" || !event.id) return;

  const url = event.url ?? `/e/${event.id}`;
  const title = event.title?.trim() || "無題のイベント";
  const next: RecentEvent = {
    id: event.id,
    title,
    url,
    kind: event.kind,
    updatedAt: new Date().toISOString(),
  };

  const events = getRecentEvents()
    .filter((item) => item.id !== event.id)
    .slice(0, MAX_RECENT_EVENTS - 1);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...events]));
  window.dispatchEvent(new Event("komaro_recent_events_changed"));
}

function isRecentEvent(value: unknown): value is RecentEvent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RecentEvent>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.url === "string" &&
    typeof item.updatedAt === "string" &&
    (item.kind === "created" || item.kind === "joined" || item.kind === "viewed")
  );
}
