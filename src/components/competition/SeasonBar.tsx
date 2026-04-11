"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import Link from "next/link";

interface SeasonData {
  active: {
    number: number;
    name: string;
    status: string;
    startAt: string;
    endAt: string;
    votingStartAt?: string;
    votingEndAt?: string;
  } | null;
  champion: {
    id: string;
    name: string;
    number: number;
    championCountryId: string;
    endAt: string;
    country: { id: string; nameEn: string; flagEmoji: string } | null;
  } | null;
}

interface LeadingCountry {
  flag: string;
  name: string;
}

export default function SeasonBar({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<SeasonData | null>(null);
  const [leading, setLeading] = useState<LeadingCountry | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/seasons")
      .then((r) => r.json())
      .then((d) => {
        setData({ active: d.active || null, champion: d.champion || null });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

    fetch("/api/leaderboard?type=country&limit=1")
      .then((r) => r.json())
      .then((d) => {
        const entry = d.entries?.[0];
        if (entry?.country) {
          setLeading({ flag: entry.country.flagEmoji, name: entry.country.nameEn });
        }
      })
      .catch((e) => { console.error("Failed to fetch leaderboard data:", e); });
  }, []);

  // Update time left every minute
  useEffect(() => {
    const season = data?.active;
    if (!season?.endAt) return;

    function update() {
      const end = new Date(season!.endAt).getTime();
      const start = new Date(season!.startAt).getTime();
      const now = Date.now();
      const remaining = end - now;
      const total = end - start;

      if (remaining <= 0) {
        setTimeLeft(t("season.ended"));
        setProgress(100);
        setDaysRemaining(0);
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

      setDaysRemaining(days);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else {
        setTimeLeft(`${hours}h ${mins}m`);
      }

      setProgress(Math.round(((total - remaining) / total) * 100));
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [data?.active, t]);

  if (!loaded) return null;

  const season = data?.active;
  const champion = data?.champion;
  const isEndingSoon = daysRemaining !== null && daysRemaining < 7;

  // Champion banner — show above season bar if there's a recent champion
  // (visible for 1 year after season ends)
  const showChampionBanner = champion?.country && (() => {
    const endDate = new Date(champion.endAt);
    const oneYearAfter = new Date(endDate);
    oneYearAfter.setFullYear(oneYearAfter.getFullYear() + 1);
    return Date.now() < oneYearAfter.getTime();
  })();

  return (
    <div className={className}>
      {/* Champion Banner */}
      {showChampionBanner && champion?.country && (
        <div className="bg-gradient-to-r from-[#c9a84c]/20 via-[#c9a84c]/10 to-[#c9a84c]/20 border-b border-[#c9a84c]/30 px-4 py-1.5">
          <div className="max-w-[1280px] mx-auto flex items-center justify-center gap-2 text-xs">
            <span className="text-lg">{champion.country.flagEmoji}</span>
            <span className="text-[#c9a84c] font-bold">
              {t("season.champion", { year: new Date(champion.endAt).getFullYear(), country: champion.country.nameEn })}
            </span>
            <span className="text-lg">{champion.country.flagEmoji}</span>
          </div>
        </div>
      )}

      {/* Season Bar */}
      <div className={`bg-background-surface border-b border-border px-4 py-1.5 ${
        isEndingSoon ? "animate-[pulse_3s_ease-in-out_infinite]" : ""
      }`}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            {!season ? (
              // No active season
              <>
                <span className="text-[#c9a84c] font-semibold">{t("season.openSeason")}</span>
                <span className="text-foreground-subtle">&middot;</span>
                <span className="text-foreground-muted">{t("season.allTimeRankings")}</span>
              </>
            ) : season.status === "JUDGING" ? (
              // Voting phase
              <>
                <span className="text-[#c9a84c] font-semibold">{t("season.title")} {season.number}</span>
                <span className="text-foreground-subtle">&middot;</span>
                <Link
                  href="/seasons/vote"
                  className="text-[#c9a84c] hover:underline font-medium"
                >
                  {t("season.voteOpen")}
                </Link>
              </>
            ) : (
              // Active season
              <>
                <Link href="/championship" className="text-[#c9a84c] font-semibold hover:underline">
                  {t("season.title")} {season.number}
                </Link>
                <span className="text-foreground-subtle">&middot;</span>
                {/* Countdown with days/hours format */}
                <span className={`font-medium ${isEndingSoon ? "text-orange-400" : "text-foreground-muted"}`}>
                  {isEndingSoon && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5 animate-pulse" />
                  )}
                  {t("season.left", { time: timeLeft })}
                </span>
              </>
            )}

            {leading && (
              <>
                <span className="text-foreground-subtle">&middot;</span>
                <span className="text-foreground-muted">
                  <span className="mr-0.5">{leading.flag}</span>
                  {t("season.leading", { flag: "", name: leading.name })}
                </span>
              </>
            )}
          </div>

          {/* Progress bar (only for active season) */}
          {season && season.status === "ACTIVE" && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-1 bg-background-overlay rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isEndingSoon
                      ? "bg-gradient-to-r from-orange-400 to-[#c9a84c]"
                      : "bg-[#c9a84c]"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-foreground-subtle">{progress}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
