"use client";

import { useEffect, useState } from "react";

interface VsEvent {
  id: string;
  title: string;
  country1: { nameEn: string; flagEmoji: string };
  country2: { nameEn: string; flagEmoji: string };
  country1Score: number;
  country2Score: number;
  endAt: string;
}

export default function VsEventBanner() {
  const [event, setEvent] = useState<VsEvent | null>(null);

  useEffect(() => {
    fetch("/api/vs-events?status=ACTIVE")
      .then((r) => r.json())
      .then((data) => setEvent(data.events?.[0] ?? null))
      .catch(() => {});
  }, []);

  if (!event) return null;

  const total = event.country1Score + event.country2Score || 1;
  const pct1 = Math.round((event.country1Score / total) * 100);
  const pct2 = 100 - pct1;
  const daysLeft = Math.max(0, Math.ceil((new Date(event.endAt).getTime() - Date.now()) / 86400000));

  return (
    <div className="bg-background-surface border border-[#c9a84c]/30 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">⚔️</span>
          <span className="text-xs font-bold text-[#c9a84c]">{event.title}</span>
        </div>
        <span className="text-[10px] text-foreground-subtle">{daysLeft}d left</span>
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="w-6 text-center">{event.country1.flagEmoji}</span>
        <div className="flex-1 h-2 bg-background-elevated rounded-full overflow-hidden flex">
          <div className="h-full bg-[#c9a84c] transition-all duration-700" style={{ width: `${pct1}%` }} />
          <div className="h-full bg-foreground-subtle/30 transition-all duration-700" style={{ width: `${pct2}%` }} />
        </div>
        <span className="w-6 text-center">{event.country2.flagEmoji}</span>
      </div>

      <div className="flex justify-between text-[10px] text-foreground-subtle">
        <span>{event.country1.flagEmoji} {event.country1Score.toLocaleString()}pts</span>
        <span>{event.country2Score.toLocaleString()}pts {event.country2.flagEmoji}</span>
      </div>
    </div>
  );
}
