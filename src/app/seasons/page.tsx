"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

interface MonthlyWinnerData {
  id: string;
  month: number;
  year: number;
  likeCount: number;
  post: {
    id: string;
    title: string;
    reactionCount: number;
    images: { originalUrl: string }[];
  };
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isChampion: boolean;
  };
  country: { id: string; nameEn: string; flagEmoji: string } | null;
  _count: { finalVotes: number };
}

interface SeasonInfo {
  id: string;
  name: string;
  status: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function SeasonsPage() {
  const [winners, setWinners] = useState<MonthlyWinnerData[]>([]);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seasons/monthly-winner")
      .then((r) => r.json())
      .then((data) => {
        setWinners(data.winners || []);
        setSeason(data.season || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-background-elevated rounded w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-background-elevated rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {season ? season.name : "Season Dashboard"}
        </h1>
        <p className="text-sm text-foreground-subtle">
          {season?.status === "JUDGING"
            ? "Final voting is open! Vote for your favorite meme of the year."
            : season?.status === "ACTIVE"
              ? "Monthly winners are selected based on the most liked meme each month."
              : "View past monthly winners and season results."}
        </p>
        {season?.status === "JUDGING" && (
          <Link
            href="/seasons/vote"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#c9a84c] hover:bg-[#d4b65e] text-black font-semibold rounded-lg transition-colors text-sm"
          >
            Vote Now
          </Link>
        )}
      </div>

      {/* Monthly Winners Grid */}
      {winners.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🏆</p>
          <p className="text-foreground-muted">No monthly winners yet.</p>
          <p className="text-sm text-foreground-subtle mt-1">
            Winners are selected at the start of each month.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {winners.map((winner) => (
            <Link
              key={winner.id}
              href={`/post/${winner.post.id}`}
              className="group bg-background-surface border border-border rounded-xl overflow-hidden hover:border-[#c9a84c]/50 transition-colors"
            >
              {/* Image */}
              <div className="aspect-[4/3] relative overflow-hidden bg-background-elevated">
                {winner.post.images[0]?.originalUrl && (
                  <img
                    src={winner.post.images[0].originalUrl}
                    alt={winner.post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                {/* Month Badge */}
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
                  <span className="text-xs font-bold text-[#c9a84c]">
                    {MONTH_NAMES[winner.month - 1]}
                  </span>
                </div>
                {/* Like count */}
                <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                  <span className="text-xs">🔥</span>
                  <span className="text-xs text-white font-medium">{winner.likeCount}</span>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="text-sm font-medium text-foreground truncate mb-2">
                  {winner.post.title}
                </h3>
                <div className="flex items-center gap-2">
                  <Avatar
                    src={winner.author.avatarUrl}
                    alt={winner.author.displayName || winner.author.username}
                    size="sm"
                    isChampion={winner.author.isChampion}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground-muted truncate">
                      {winner.author.displayName || winner.author.username}
                    </p>
                    {winner.country && (
                      <p className="text-[10px] text-foreground-subtle">
                        {winner.country.flagEmoji} {winner.country.nameEn}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {/* Empty slots for remaining months */}
          {Array.from({ length: 12 - winners.length }, (_, i) => {
            const month = winners.length > 0
              ? winners[winners.length - 1].month + i + 1
              : i + 1;
            if (month > 12) return null;
            return (
              <div
                key={`empty-${month}`}
                className="bg-background-surface border border-border border-dashed rounded-xl flex flex-col items-center justify-center aspect-[4/3] opacity-40"
              >
                <span className="text-2xl mb-2">🏆</span>
                <span className="text-xs text-foreground-subtle">
                  {MONTH_NAMES[month - 1]}
                </span>
                <span className="text-[10px] text-foreground-subtle mt-1">TBD</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
