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
        {season?.status === "JUDGING" && (
          <Link
            href="/seasons/vote"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#c9a84c] hover:bg-[#d4b65e] text-black font-semibold rounded-lg transition-colors text-sm"
          >
            {t("season.voteNow")}
          </Link>
        )}
      </div>

      {/* Season Info Card — shown during ACTIVE or JUDGING */}
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

          {/* How It Works steps */}
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
                  className="flex items-start gap-2.5 bg-background-surface/50 rounded-lg p-3"
                >
                  <span className="text-base mt-0.5 shrink-0">{step.icon}</span>
                  <p className="text-xs text-foreground-muted leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="px-5 py-4 bg-background-surface/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-foreground-subtle">
                {t("season.currentProgress")}
              </p>
              <p className="text-xs text-foreground-muted">
                {t("season.monthsCompleted", { count: String(winners.length) })}
              </p>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const isWinner = winners.some((w) => w.month === month);
                const isCurrent = month === currentMonth;
                return (
                  <div
                    key={month}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      isWinner
                        ? "bg-[#c9a84c]"
                        : isCurrent
                          ? "bg-[#c9a84c]/40 animate-pulse"
                          : "bg-foreground/10"
                    }`}
                    title={MONTH_NAMES[i]}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-foreground-subtle">Jan</span>
              <span className="text-[10px] text-foreground-subtle">Dec</span>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Winners Grid */}
      <h2 className="text-lg font-semibold text-foreground mb-4">
        {t("season.monthlyWinners")}
      </h2>
      {winners.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">🏆</p>
          <p className="text-foreground-muted">{t("season.noWinners")}</p>
          <p className="text-sm text-foreground-subtle mt-1">
            {t("season.winnersDescription")}
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
                  <span className="text-xs">⬆️</span>
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
