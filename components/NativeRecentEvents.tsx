"use client";

import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getRecentEvents, RecentEvent } from "@/lib/recentEvents";

const kindLabel: Record<RecentEvent["kind"], string> = {
  created: "作成",
  joined: "参加",
  viewed: "閲覧",
};

export function NativeRecentEvents() {
  const [isNative, setIsNative] = useState(false);
  const [events, setEvents] = useState<RecentEvent[]>([]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsNative(Capacitor.isNativePlatform());
      setEvents(getRecentEvents());
    });

    const handleChange = () => setEvents(getRecentEvents());
    window.addEventListener("komaro_recent_events_changed", handleChange);
    window.addEventListener("storage", handleChange);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("komaro_recent_events_changed", handleChange);
      window.removeEventListener("storage", handleChange);
    };
  }, []);

  if (!isNative || events.length === 0) return null;

  return (
    <section className="border-b border-gray-100 bg-white py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarClock size={18} className="shrink-0 text-gray-500" />
            <h2 className="truncate text-sm font-semibold text-gray-900">最近のイベント</h2>
          </div>
          <span className="shrink-0 text-xs text-gray-400">この端末に保存</span>
        </div>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {events.slice(0, 4).map((event) => (
            <Link
              key={event.id}
              href={event.url}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{event.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">{kindLabel[event.kind]}したイベント</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
