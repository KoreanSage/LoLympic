"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";

const CACHE_KEY = "mimzy_country_rankings_cache";

interface CachedRanking {
  countryId: string;
  rank: number;
  name: string;
  flag: string;
}

export default function RankChangeToast() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [toast, setToast] = useState<{
    message: string;
    type: "up" | "down";
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!session?.user) return;
    const userCountryId = session.user.countryId;
    if (!userCountryId) return;

    fetch("/api/leaderboard?type=country&limit=50")
      .then((r) => r.json())
      .then((data) => {
        const entries: CachedRanking[] = (data.entries ?? []).map(
          (e: any) => ({
            countryId: e.country.id,
            rank: e.rank,
            name: e.country.nameEn,
            flag: e.country.flagEmoji,
          })
        );

        // Get previously cached rankings
        const cached = localStorage.getItem(CACHE_KEY);
        const previous: CachedRanking[] = cached
          ? JSON.parse(cached)
          : [];

        // Save current rankings to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(entries));

        // If no previous data, skip (first load)
        if (previous.length === 0) return;

        // Find user's country in both
        const prevEntry = previous.find(
          (e) => e.countryId === userCountryId
        );
        const currEntry = entries.find(
          (e) => e.countryId === userCountryId
        );

        if (!prevEntry || !currEntry) return;
        if (prevEntry.rank === currEntry.rank) return;

        if (currEntry.rank < prevEntry.rank) {
          // Moved up (lower rank number = better)
          setToast({
            message: `🎉 ${t("rankChange.movedUp", {
              rank: String(currEntry.rank),
            })}`,
            type: "up",
          });
        } else {
          // Moved down
          setToast({
            message: t("rankChange.movedDown", {
              rank: String(currEntry.rank),
            }),
            type: "down",
          });
        }

        // Show with animation
        timersRef.current.push(setTimeout(() => setVisible(true), 100));

        // Auto-dismiss after 5 seconds
        timersRef.current.push(
          setTimeout(() => {
            setVisible(false);
            timersRef.current.push(setTimeout(() => setToast(null), 400));
          }, 5000)
        );
      })
      .catch(() => {});

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [session?.user, t]);

  if (!toast) return null;

  return (
    <div
      className={`
        fixed top-20 left-1/2 -translate-x-1/2 z-[90]
        transition-all duration-400 ease-out
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}
      `}
    >
      <div
        className={`
          px-5 py-3 rounded-2xl backdrop-blur-md border shadow-lg
          text-sm font-medium
          ${
            toast.type === "up"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-amber-500/15 border-amber-500/30 text-amber-400"
          }
        `}
      >
        {toast.message}
      </div>
    </div>
  );
}
