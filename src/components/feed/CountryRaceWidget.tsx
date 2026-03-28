"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTranslation } from "@/i18n";

interface CountryEntry {
  rank: number;
  country: { nameEn: string; flagEmoji: string; id: string };
  score: number;
}

const DISMISS_KEY = "mimzy_country_race_dismissed";
const REFRESH_INTERVAL = 60_000; // 60 seconds

export default function CountryRaceWidget() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(true); // Start hidden until we check
  const [userCountry, setUserCountry] = useState<{
    id: string;
    nameEn: string;
    flagEmoji: string;
  } | null>(null);
  const [myEntry, setMyEntry] = useState<CountryEntry | null>(null);
  const [competitor, setCompetitor] = useState<CountryEntry | null>(null);
  const [allEntries, setAllEntries] = useState<CountryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Check dismiss state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const d = localStorage.getItem(DISMISS_KEY);
    // Allow re-show after 24 hours
    if (d) {
      const dismissedAt = parseInt(d, 10);
      if (Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }
    setDismissed(false);
  }, []);

  // Fetch user's country
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/users/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.country) {
          setUserCountry(data.country);
        }
      })
      .catch(() => {});
  }, [session?.user]);

  const fetchRankings = useCallback(() => {
    if (!userCountry) return;
    fetch("/api/leaderboard?type=country&limit=50")
      .then((r) => r.json())
      .then((data) => {
        const entries: CountryEntry[] = (data.entries ?? []).map(
          (e: any) => ({
            rank: e.rank,
            country: e.country,
            score: e.score,
          })
        );
        setAllEntries(entries);

        const mine = entries.find(
          (e) => e.country.id === userCountry.id
        );
        setMyEntry(mine || null);

        if (mine) {
          // Find closest competitor
          if (mine.rank === 1) {
            // Leading: show the #2
            const second = entries.find((e) => e.rank === 2);
            setCompetitor(second || null);
          } else {
            // Behind: show the one ahead
            const ahead = entries.find(
              (e) => e.rank === mine.rank - 1
            );
            setCompetitor(ahead || null);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userCountry]);

  // Fetch on mount and auto-refresh
  useEffect(() => {
    fetchRankings();
    const interval = setInterval(fetchRankings, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchRankings]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  // Don't render if not logged in, no country, dismissed, or loading
  if (!session?.user || !userCountry || dismissed || loading) return null;
  if (!myEntry) return null;

  const isLeading = myEntry.rank === 1;
  const pointDiff = competitor
    ? Math.abs(myEntry.score - competitor.score)
    : 0;

  // Calculate progress bar widths
  const maxScore = Math.max(
    myEntry.score,
    competitor?.score ?? 0,
    1
  );
  const myPct = (myEntry.score / maxScore) * 100;
  const compPct = competitor ? (competitor.score / maxScore) * 100 : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#c9a84c]/30 bg-gradient-to-br from-[#c9a84c]/5 via-background-surface to-[#c9a84c]/10 p-4">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-foreground-subtle hover:text-foreground text-xs p-1 z-10"
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🏆</span>
        <div className="flex-1">
          {isLeading ? (
            <div>
              <p className="text-sm font-bold text-[#c9a84c]">
                {userCountry.flagEmoji} {t("countryRace.leading")}
              </p>
              {competitor && (
                <p className="text-xs text-foreground-muted">
                  {t("countryRace.pointsAhead", {
                    points: pointDiff.toLocaleString(),
                    country: `${competitor.country.flagEmoji} ${competitor.country.nameEn}`,
                  })}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-foreground">
                {userCountry.flagEmoji} {userCountry.nameEn}{" "}
                <span className="text-foreground-subtle font-normal">
                  {t("countryRace.vs")}
                </span>{" "}
                {competitor?.country.flagEmoji} {competitor?.country.nameEn}
              </p>
              <p className="text-xs text-foreground-muted">
                {t("countryRace.pointsBehind", {
                  points: pointDiff.toLocaleString(),
                  country: `${competitor?.country.flagEmoji ?? ""} ${competitor?.country.nameEn ?? ""}`,
                })}{" "}
                — {t("countryRace.closeGap")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-2 mb-3">
        {/* My country */}
        <div>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-foreground-muted">
              {userCountry.flagEmoji} {userCountry.nameEn}
            </span>
            <span className="font-mono font-semibold text-[#c9a84c]">
              {myEntry.score.toLocaleString()}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-background-overlay overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${Math.max(myPct, 3)}%`,
                background: isLeading
                  ? "linear-gradient(90deg, #c9a84c, #e8c84a)"
                  : "linear-gradient(90deg, #6b7280, #9ca3af)",
              }}
            />
          </div>
        </div>

        {/* Competitor */}
        {competitor && (
          <div>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-foreground-muted">
                {competitor.country.flagEmoji} {competitor.country.nameEn}
              </span>
              <span className="font-mono font-semibold text-foreground-subtle">
                {competitor.score.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-background-overlay overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.max(compPct, 3)}%`,
                  background: !isLeading
                    ? "linear-gradient(90deg, #c9a84c, #e8c84a)"
                    : "linear-gradient(90deg, #6b7280, #9ca3af)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <Link
        href="/upload"
        className="block w-full text-center text-xs font-semibold py-2 rounded-xl bg-[#c9a84c] hover:bg-[#d4b85c] text-black transition-colors"
      >
        {t("countryRace.uploadHelp")} →
      </Link>
    </div>
  );
}
