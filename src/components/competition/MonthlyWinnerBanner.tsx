"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/i18n";
import Link from "next/link";

interface WinnerInfo {
  month: number;
  year: number;
  post: {
    id: string;
    title: string;
    images: { originalUrl: string }[];
  };
  author: {
    displayName: string | null;
    username: string;
  };
  country: { flagEmoji: string; nameEn: string } | null;
  likeCount: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MonthlyWinnerBanner() {
  const { t } = useTranslation();
  const [winner, setWinner] = useState<WinnerInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed this month
    const key = `mw-dismissed-${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    if (sessionStorage.getItem(key)) return;

    fetch("/api/seasons/monthly-winner")
      .then((r) => r.json())
      .then((data) => {
        const winners = data.winners || [];
        if (winners.length === 0) return;

        // Show the most recent winner
        const latest = winners[winners.length - 1];
        // Only show if it was selected this month or last month
        const now = new Date();
        const winnerDate = new Date(latest.year, latest.month - 1);
        const monthsDiff = (now.getFullYear() - winnerDate.getFullYear()) * 12 + (now.getMonth() - winnerDate.getMonth());
        if (monthsDiff <= 1) {
          setWinner(latest);
        }
      })
      .catch((e) => { console.error("Failed to fetch monthly winner:", e); });
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    const key = `mw-dismissed-${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    sessionStorage.setItem(key, "1");
  };

  if (!winner || dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-[#c9a84c]/15 via-[#c9a84c]/5 to-[#c9a84c]/15 border border-[#c9a84c]/25 rounded-xl p-4 mb-4 overflow-hidden">
      {/* Decorative top gold line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c]/60 to-transparent" />

      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-background-overlay text-foreground-subtle hover:text-foreground-muted transition-colors z-10"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center gap-4">
        {/* Thumbnail with gold border */}
        {winner.post.images[0]?.originalUrl && (
          <Link
            href={`/post/${winner.post.id}`}
            className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 border-[#c9a84c]/40 shadow-[0_0_8px_rgba(201,168,76,0.15)] hover:border-[#c9a84c] transition-colors"
          >
            <Image
              src={winner.post.images[0].originalUrl}
              alt={winner.post.title}
              width={64}
              height={64}
              className="w-full h-full object-cover"
              priority
              unoptimized
            />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">🏆</span>
            <span className="text-xs font-bold text-[#c9a84c]">
              {t("season.memeOfTheMonth", { month: MONTH_NAMES[winner.month - 1] })}
            </span>
          </div>
          <Link
            href={`/post/${winner.post.id}`}
            className="text-sm font-medium text-foreground hover:text-[#c9a84c] transition-colors truncate block"
          >
            {winner.post.title}
          </Link>
          <p className="text-xs text-foreground-subtle mt-0.5">
            by {winner.author.displayName || winner.author.username}
            {winner.country && ` ${winner.country.flagEmoji}`}
            {" · "}🔥 {winner.likeCount}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0 hidden sm:flex">
          <Link
            href={`/post/${winner.post.id}`}
            className="text-xs text-[#c9a84c] hover:text-[#d4b65e] font-medium transition-colors"
          >
            View Details →
          </Link>
          <Link
            href="/leaderboard"
            className="text-[10px] text-foreground-subtle hover:text-foreground-muted transition-colors"
          >
            {t("season.viewAll")}
          </Link>
        </div>
      </div>
    </div>
  );
}
