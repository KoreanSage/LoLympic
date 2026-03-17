"use client";

import { useEffect, useState } from "react";
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
      .catch(() => {});
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    const key = `mw-dismissed-${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    sessionStorage.setItem(key, "1");
  };

  if (!winner || dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-[#c9a84c]/15 via-[#c9a84c]/5 to-[#c9a84c]/15 border border-[#c9a84c]/20 rounded-xl p-4 mb-4">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-background-overlay text-foreground-subtle hover:text-foreground-muted transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        {winner.post.images[0]?.originalUrl && (
          <Link
            href={`/post/${winner.post.id}`}
            className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-border"
          >
            <img
              src={winner.post.images[0].originalUrl}
              alt={winner.post.title}
              className="w-full h-full object-cover"
            />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#c9a84c]">
              🏆 {MONTH_NAMES[winner.month - 1]} Meme of the Month
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

        <Link
          href="/seasons"
          className="text-xs text-[#c9a84c] hover:underline flex-shrink-0 hidden sm:block"
        >
          View all →
        </Link>
      </div>
    </div>
  );
}
