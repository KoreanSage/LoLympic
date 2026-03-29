"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
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
  description: string | null;
  startAt: string;
  endAt: string;
  number: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getTimeRemaining(endAt: string) {
  const now = new Date();
  const end = new Date(endAt);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months}mo ${days % 30}d`;
  }
  return `${days}d`;
}

export default function SeasonsPage() {
  const { t } = useTranslation();
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

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const winnerMonths = new Set(winners.map((w) => w.month));

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-background-elevated rounded w-64" />
          <div className="h-40 bg-background-elevated rounded-xl" />
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {season ? season.name : t("season.dashboard")}
        </h1>
        <p className="text-sm text-foreground-subtle">
          {season?.status === "JUDGING"
            ? t("season.judgingDescription")
            : season?.status === "ACTIVE"
              ? t("season.activeDescription")
              : t("season.pastDescription")}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {season?.status === "JUDGING" && (
            <Link
              href="/seasons/vote"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#c9a84c] hover:bg-[#d4b65e] text-black font-semibold rounded-lg transition-colors text-sm"
            >
              {t("season.voteNow")}
            </Link>
          )}
          {season?.status === "ACTIVE" && (
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#c9a84c] hover:bg-[#d4b65e] text-black font-bold rounded-lg transition-all text-sm shadow-[0_0_16px_rgba(201,168,76,0.3)] hover:shadow-[0_0_24px_rgba(201,168,76,0.45)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Upload Your Meme
            </Link>
          )}
        </div>
      </div>

      {/* Season Info Card */}
      {season && (season.status === "ACTIVE" || season.status === "JUDGING") && (
        <div className="mb-8 bg-gradient-to-br from-[#c9a84c]/10 to-[#c9a84c]/5 border border-[#c9a84c]/20 rounded-2xl overflow-hidden">
          {/* Top bar with season period */}
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#c9a84c]/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#c9a84c]/20 flex items-center justify-center text-lg">
                🏟️
              </div>
              <div>
                <p className="text-xs text-foreground-subtle font-medium uppercase tracking-wide">
                  {t("season.seasonPeriod")}
                </p>
                <p className="text-sm text-foreground font-semibold">
                  {formatDate(season.startAt)} — {formatDate(season.endAt)}
                </p>
              </div>
            </div>
            {season.status === "ACTIVE" && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                <span className="text-xs font-semibold text-green-500 uppercase">LIVE</span>
                {getTimeRemaining(season.endAt) && (
                  <span className="text-xs text-foreground-subtle ml-1">
                    ({t("season.left", { time: getTimeRemaining(season.endAt)! })})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {season.description && (
            <div className="px-5 py-4 border-b border-[#c9a84c]/10">
              <p className="text-sm text-foreground-muted leading-relaxed">
                {season.description}
              </p>
            </div>
          )}

          {/* How It Works steps - with gold numbered circles */}
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {t("season.howItWorks")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: "📝", text: t("season.step1") },
                { icon: "🏆", text: t("season.step2") },
                { icon: "⚔️", text: t("season.step3") },
                { icon: "👑", text: t("season.step4") },
              ].map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-background-surface/50 rounded-lg p-3"
                >
                  <div className="w-7 h-7 rounded-full bg-[#c9a84c] text-black flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <span className="text-base mr-1.5">{step.icon}</span>
                    <span className="text-xs text-foreground-muted leading-relaxed">{step.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress — milestone dots */}
          <div className="px-5 py-4 bg-background-surface/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-foreground-subtle">
                {t("season.currentProgress")}
              </p>
              <p className="text-xs text-foreground-muted">
                {t("season.monthsCompleted", { count: String(winners.length) })}
              </p>
            </div>
            {/* Milestone dots with connecting line — horizontally scrollable on mobile */}
            <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
              <div className="relative min-w-[480px] sm:min-w-0">
                {/* Background track */}
                <div className="absolute top-3 left-0 right-0 h-0.5 bg-foreground/10 rounded-full" />
                {/* Filled track */}
                <div
                  className="absolute top-3 left-0 h-0.5 bg-[#c9a84c] rounded-full transition-all duration-1000"
                  style={{ width: `${(Math.max(0, currentMonth - 1) / 11) * 100}%` }}
                />
                <div className="flex justify-between relative">
                  {Array.from({ length: 12 }, (_, i) => {
                    const month = i + 1;
                    const isWinner = winnerMonths.has(month);
                    const isCurrent = month === currentMonth;
                    const isPast = month < currentMonth;
                    return (
                      <div key={month} className="flex flex-col items-center" title={MONTH_NAMES[i]}>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                            isWinner
                              ? "bg-[#c9a84c] text-black shadow-[0_0_8px_rgba(201,168,76,0.4)]"
                              : isCurrent
                                ? "bg-[#c9a84c]/30 text-[#c9a84c] border-2 border-[#c9a84c] animate-pulse"
                                : isPast
                                  ? "bg-foreground/15 text-foreground-subtle"
                                  : "bg-foreground/5 text-foreground-subtle/50"
                          }`}
                        >
                          {isWinner ? "✓" : MONTH_ABBREV[i].charAt(0)}
                        </div>
                        <span className={`text-[9px] mt-1 ${
                          isCurrent ? "text-[#c9a84c] font-bold" : "text-foreground-subtle"
                        }`}>
                          {MONTH_ABBREV[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Winners Grid — always shows all season months (Apr-Dec) */}
      <h2 className="text-lg font-semibold text-foreground mb-4">
        {t("season.monthlyWinners")}
      </h2>
      {(() => {
        // Season runs April (4) through December (12)
        const seasonStartMonth = season ? new Date(season.startAt).getMonth() + 1 : 4;
        const seasonEndMonth = season ? new Date(season.endAt).getMonth() + 1 : 12;
        const seasonMonths = Array.from(
          { length: seasonEndMonth - seasonStartMonth + 1 },
          (_, i) => seasonStartMonth + i
        );
        const winnerByMonth = new Map(winners.map((w) => [w.month, w]));

        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {seasonMonths.map((month) => {
              const winner = winnerByMonth.get(month);
              const isCurrent = month === currentMonth;
              const isFuture = month > currentMonth;

              // Winner card — framed thumbnail
              if (winner) {
                return (
                  <Link
                    key={`month-${month}`}
                    href={`/post/${winner.post.id}`}
                    className="group bg-background-surface border-2 border-[#c9a84c]/40 rounded-xl overflow-hidden hover:border-[#c9a84c] transition-colors shadow-[0_0_12px_rgba(201,168,76,0.1)] hover:shadow-[0_0_20px_rgba(201,168,76,0.2)]"
                  >
                    <div className="aspect-[4/3] relative overflow-hidden bg-background-elevated">
                      {winner.post.images[0]?.originalUrl && (
                        <img
                          src={winner.post.images[0].originalUrl}
                          alt={winner.post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      {/* Month badge */}
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
                        <span className="text-xs font-bold text-[#c9a84c]">
                          {MONTH_ABBREV[month - 1]}
                        </span>
                      </div>
                      {/* Crown overlay */}
                      <div className="absolute top-2 right-2">
                        <span className="text-lg drop-shadow-lg">👑</span>
                      </div>
                      {/* Vote count */}
                      <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                        <span className="text-[10px]">🔥</span>
                        <span className="text-[10px] text-white font-medium">{winner.likeCount}</span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-foreground truncate mb-1.5">
                        {winner.post.title}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          src={winner.author.avatarUrl}
                          alt={winner.author.displayName || winner.author.username}
                          size="sm"
                          isChampion={winner.author.isChampion}
                        />
                        <span className="text-[11px] text-foreground-muted truncate">
                          {winner.author.displayName || winner.author.username}
                        </span>
                        {winner.country && (
                          <span className="text-xs ml-auto">{winner.country.flagEmoji}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              }

              // Current month — voting in progress
              if (isCurrent) {
                return (
                  <div
                    key={`month-${month}`}
                    className="bg-background-surface border-2 border-[#c9a84c]/30 border-dashed rounded-xl flex flex-col items-center justify-center aspect-[4/3] relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-[#c9a84c]/5 to-transparent" />
                    <span className="text-2xl mb-1.5">🔥</span>
                    <span className="text-sm font-bold text-[#c9a84c]">
                      {MONTH_NAMES[month - 1]}
                    </span>
                    <span className="text-[11px] text-[#c9a84c]/80 font-medium mt-0.5">
                      Voting
                    </span>
                    <div className="absolute top-2 right-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a84c] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c9a84c]" />
                      </span>
                    </div>
                  </div>
                );
              }

              // Future month — locked
              if (isFuture) {
                return (
                  <div
                    key={`month-${month}`}
                    className="bg-background-surface border border-border border-dashed rounded-xl flex flex-col items-center justify-center aspect-[4/3] group opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-foreground/5 flex items-center justify-center mb-1.5 group-hover:bg-foreground/10 transition-colors">
                      <svg className="w-4 h-4 text-foreground-subtle/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-foreground-subtle">
                      {MONTH_NAMES[month - 1]}
                    </span>
                  </div>
                );
              }

              // Past month with no winner — empty dashed placeholder
              return (
                <div
                  key={`month-${month}`}
                  className="bg-background-surface border border-border border-dashed rounded-xl flex flex-col items-center justify-center aspect-[4/3]"
                >
                  <span className="text-xs font-medium text-foreground-subtle">
                    {MONTH_NAMES[month - 1]}
                  </span>
                  <span className="text-[10px] text-foreground-subtle/60 mt-0.5">No winner</span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
