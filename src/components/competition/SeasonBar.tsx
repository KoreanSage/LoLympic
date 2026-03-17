"use client";

import { useEffect, useState } from "react";

interface SeasonData {
  active: {
    number: number;
    name: string;
    startAt: string;
    endAt: string;
  } | null;
}

interface LeadingCountry {
  flag: string;
  name: string;
}

export default function SeasonBar({ className = "" }: { className?: string }) {
  const [season, setSeason] = useState<SeasonData["active"]>(null);
  const [leading, setLeading] = useState<LeadingCountry | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Fetch season info
    fetch("/api/seasons")
      .then((r) => r.json())
      .then((data) => {
        setSeason(data.active || null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

    // Fetch leading country from leaderboard
    fetch("/api/leaderboard?type=country&limit=1")
      .then((r) => r.json())
      .then((data) => {
        const entry = data.entries?.[0];
        if (entry?.country) {
          setLeading({
            flag: entry.country.flagEmoji,
            name: entry.country.nameEn,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Update time left every minute
  useEffect(() => {
    if (!season?.endAt) return;

    function update() {
      const end = new Date(season!.endAt).getTime();
      const start = new Date(season!.startAt).getTime();
      const now = Date.now();
      const remaining = end - now;
      const total = end - start;

      if (remaining <= 0) {
        setTimeLeft("Ended");
        setProgress(100);
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else {
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${hours}h ${mins}m`);
      }

      setProgress(Math.round(((total - remaining) / total) * 100));
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [season]);

  if (!loaded) return null;

  // No active season — show open/all-time mode
  if (!season) {
    return (
      <div
        className={`bg-background-surface border-b border-border px-4 py-1.5 ${className}`}
      >
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[#c9a84c] font-semibold">
              🌐 Open Season
            </span>
            <span className="text-foreground-subtle">&middot;</span>
            <span className="text-foreground-muted">All-time rankings</span>
            {leading && (
              <>
                <span className="text-foreground-subtle">&middot;</span>
                <span className="text-foreground-muted">
                  Leading: {leading.flag} {leading.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active season
  return (
    <div
      className={`bg-background-surface border-b border-border px-4 py-1.5 ${className}`}
    >
      <div className="max-w-[1280px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#c9a84c] font-semibold">
            Season {season.number}
          </span>
          <span className="text-foreground-subtle">&middot;</span>
          <span className="text-foreground-muted">{timeLeft} left</span>
          {leading && (
            <>
              <span className="text-foreground-subtle">&middot;</span>
              <span className="text-foreground-muted">
                Leading: {leading.flag} {leading.name}
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-24 h-1 bg-background-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c9a84c] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-foreground-subtle">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
