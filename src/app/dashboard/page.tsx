"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";

interface CountryInfo {
  id: string;
  nameEn: string;
  flagEmoji: string | null;
}

interface Ranking {
  rank: number;
  country: CountryInfo;
  score: number;
  postCount: number;
}

interface MonthlyLeader {
  month: number;
  year: number;
  country: { flagEmoji: string | null; nameEn: string } | null;
  postTitle: string;
  score: number;
}

interface TopMeme {
  id: string;
  title: string;
  reactionCount: number;
  images: { originalUrl: string }[];
  author: { username: string; displayName: string | null };
  country: { flagEmoji: string | null; nameEn: string } | null;
}

interface DashboardData {
  season: { id: string; name: string; status: string } | null;
  stats: {
    totalPosts: number;
    totalReactions: number;
    totalCountries: number;
    topMeme: TopMeme | null;
  };
  rankings: Ranking[];
  monthlyLeaders: MonthlyLeader[];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getMedalEmoji(rank: number): string {
  if (rank === 1) return "\u{1F947}";
  if (rank === 2) return "\u{1F948}";
  if (rank === 3) return "\u{1F949}";
  return "";
}

function getRankColor(rank: number): string {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#C0C0C0";
  if (rank === 3) return "#CD7F32";
  return "#c9a84c";
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
        // Trigger bar animation after mount
        setTimeout(() => setBarsVisible(true), 100);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const currentMonth = new Date().getMonth() + 1;

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-4xl mx-auto pb-12">
        {/* Header */}
        <div className="mb-8 pt-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <span className="text-3xl">{"\u{1F4CA}"}</span>
            {t("dashboard.title")}
          </h1>
          {data?.season && (
            <p className="text-foreground-subtle mt-1 text-sm">
              {t("dashboard.subtitle")} &mdash; {data.season.name}
            </p>
          )}
          {!data?.season && !loading && (
            <p className="text-foreground-subtle mt-1 text-sm">
              {t("dashboard.subtitle")}
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-foreground-subtle">
            {t("common.error")}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Section 1: Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
              <StatCard
                icon={"\u{1F30D}"}
                label={t("dashboard.activeCountries")}
                value={data.stats.totalCountries}
              />
              <StatCard
                icon={"\u{1F5BC}\uFE0F"}
                label={t("dashboard.totalPosts")}
                value={data.stats.totalPosts}
              />
              <StatCard
                icon={"\u{1F525}"}
                label={t("dashboard.totalReactions")}
                value={data.stats.totalReactions}
              />
              {data.stats.topMeme ? (
                <Link href={`/post/${data.stats.topMeme.id}`} className="block">
                  <div className="bg-background-surface border border-border rounded-xl p-4 hover:border-[#c9a84c]/40 transition-colors h-full">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{"\u{1F3C6}"}</span>
                      <span className="text-xs text-foreground-subtle">{t("dashboard.topMeme")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {data.stats.topMeme.images[0] && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-background-elevated">
                          <Image
                            src={data.stats.topMeme.images[0].originalUrl}
                            alt={data.stats.topMeme.title}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {data.stats.topMeme.title}
                        </p>
                        <p className="text-xs text-foreground-subtle">
                          {data.stats.topMeme.reactionCount} {"\u{1F525}"}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <StatCard
                  icon={"\u{1F3C6}"}
                  label={t("dashboard.topMeme")}
                  value="-"
                />
              )}
            </div>

            {/* Section 2: Country Rankings Bar Chart */}
            <div className="bg-background-surface border border-border rounded-xl p-5 sm:p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
                <span>{"\u{1F3C5}"}</span>
                {t("dashboard.countryRankings")}
              </h2>

              {data.rankings.length === 0 ? (
                <p className="text-foreground-subtle text-sm py-4">{t("dashboard.noData")}</p>
              ) : (
                <div className="space-y-3">
                  {data.rankings.slice(0, 10).map((r, i) => {
                    const maxScore = data.rankings[0]?.score || 1;
                    const pct = Math.max((r.score / maxScore) * 100, 2);
                    const medal = getMedalEmoji(r.rank);
                    const barColor = getRankColor(r.rank);

                    return (
                      <div key={r.country.id} className="group">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="w-6 text-center text-sm font-bold text-foreground-subtle">
                            {medal || `#${r.rank}`}
                          </span>
                          <span className="text-base">
                            {r.country.flagEmoji || "\u{1F3F3}\uFE0F"}
                          </span>
                          <span className="text-sm font-medium text-foreground min-w-0 truncate flex-1">
                            {r.country.nameEn}
                          </span>
                          <span className="text-xs text-foreground-subtle whitespace-nowrap">
                            {r.postCount} {t("leaderboard.posts").toLowerCase()}
                          </span>
                          <span
                            className="text-sm font-bold tabular-nums min-w-[48px] text-right"
                            style={{ color: r.rank <= 3 ? barColor : "#c9a84c" }}
                          >
                            {r.score.toLocaleString()}
                          </span>
                        </div>
                        <div className="ml-9 h-2.5 rounded-full bg-background-elevated overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{
                              width: barsVisible ? `${pct}%` : "0%",
                              backgroundColor: barColor,
                              transitionDelay: `${i * 80}ms`,
                              opacity: r.rank <= 3 ? 1 : 0.7,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: Monthly Trend */}
            <div className="bg-background-surface border border-border rounded-xl p-5 sm:p-6 mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
                <span>{"\u{1F4C5}"}</span>
                {t("dashboard.monthlyTrend")}
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {MONTH_NAMES.map((name, i) => {
                  const monthNum = i + 1;
                  const leader = data.monthlyLeaders.find((l) => l.month === monthNum);
                  const isCurrent = monthNum === currentMonth;
                  const isFuture = monthNum > currentMonth;

                  return (
                    <div
                      key={name}
                      className={`rounded-lg p-3 text-center border transition-colors ${
                        isCurrent
                          ? "border-[#c9a84c]/60 bg-[#c9a84c]/5"
                          : isFuture
                          ? "border-border/40 bg-background-elevated/30 opacity-40"
                          : "border-border bg-background-elevated/50"
                      }`}
                    >
                      <div
                        className={`text-xs font-medium mb-1 ${
                          isCurrent ? "text-[#c9a84c]" : "text-foreground-subtle"
                        }`}
                      >
                        {name}
                        {isCurrent && (
                          <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[#c9a84c] animate-pulse" />
                        )}
                      </div>
                      {leader ? (
                        <>
                          <div className="text-lg">
                            {leader.country?.flagEmoji || "\u{1F3F3}\uFE0F"}
                          </div>
                          <div className="text-[10px] text-foreground-subtle mt-0.5 truncate">
                            {leader.score.toLocaleString()} pts
                          </div>
                        </>
                      ) : (
                        <div className="text-lg opacity-20">{"\u2014"}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Quick Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/leaderboard"
                className="flex items-center gap-3 bg-background-surface border border-border rounded-xl p-4 hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5 transition-colors group"
              >
                <span className="text-2xl">{"\u{1F3C6}"}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-[#c9a84c] transition-colors">
                    {t("dashboard.viewLeaderboard")}
                  </p>
                  <p className="text-xs text-foreground-subtle">
                    {t("nav.leaderboard")}
                  </p>
                </div>
                <svg className="w-4 h-4 ml-auto text-foreground-subtle group-hover:text-[#c9a84c] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/tournament"
                className="flex items-center gap-3 bg-background-surface border border-border rounded-xl p-4 hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5 transition-colors group"
              >
                <span className="text-2xl">{"\u2694\uFE0F"}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-[#c9a84c] transition-colors">
                    {t("dashboard.viewTournament")}
                  </p>
                  <p className="text-xs text-foreground-subtle">
                    {t("battle.title")}
                  </p>
                </div>
                <svg className="w-4 h-4 ml-auto text-foreground-subtle group-hover:text-[#c9a84c] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-background-surface border border-border rounded-xl p-4 h-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-foreground-subtle">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
