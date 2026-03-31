"use client";

import React, { useState } from "react";
import Link from "next/link";
import Tabs from "@/components/ui/Tabs";
import Avatar from "@/components/ui/Avatar";
import TierBadge from "@/components/ui/TierBadge";
import MedalBadge from "./MedalBadge";
import { useTranslation } from "@/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CountryEntry {
  rank: number;
  countryId: string;
  flagEmoji: string;
  name: string;
  totalScore: number;
  perUserScore?: number;
  activeUsers?: number;
  medal?: "GOLD" | "SILVER" | "BRONZE";
  totalPosts: number;
  totalCreators: number;
}

interface CreatorEntry {
  rank: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  countryFlag?: string;
  tier?: string;
  level?: number;
  totalScore: number;
  medal?: "GOLD" | "SILVER" | "BRONZE";
  totalPosts: number;
}

interface MemeEntry {
  rank: number;
  postId: string;
  title: string;
  thumbnailUrl?: string;
  authorUsername: string;
  totalScore: number;
  medal?: "GOLD" | "SILVER" | "BRONZE";
  reactionCount: number;
}

interface LeaderboardTableProps {
  countries?: CountryEntry[];
  creators?: CreatorEntry[];
  memes?: MemeEntry[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeaderboardTable({
  countries = [],
  creators = [],
  memes = [],
  className = "",
}: LeaderboardTableProps) {
  const [activeTab, setActiveTab] = useState("countries");

  const { t } = useTranslation();

  const tabs = [
    { id: "countries", label: t("leaderboard.countries"), count: countries.length },
    { id: "creators", label: t("leaderboard.creators"), count: creators.length },
    { id: "memes", label: t("leaderboard.memes"), count: memes.length },
  ];

  return (
    <div className={className}>
      <Tabs tabs={tabs} defaultTab="countries" onChange={setActiveTab} />

      <div className="mt-4 overflow-x-auto">
        {activeTab === "countries" && (
          <CountryTable entries={countries} />
        )}
        {activeTab === "creators" && (
          <CreatorTable entries={creators} />
        )}
        {activeTab === "memes" && (
          <MemeTable entries={memes} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-tables
// ---------------------------------------------------------------------------

const CountryTable = React.memo(function CountryTable({ entries }: { entries: CountryEntry[] }) {
  const { t } = useTranslation();
  if (entries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="flex items-center gap-2 md:gap-3 px-2 md:px-4 py-1 text-[10px] text-foreground-subtle uppercase tracking-wider font-medium">
        <span className="w-6 text-right">#</span>
        <span className="w-5" />
        <span className="flex-1" />
        <span className="hidden sm:inline w-12 text-right">{t("leaderboard.users")}</span>
        <span className="hidden sm:inline w-14 text-right">{t("leaderboard.total")}</span>
        <span className="w-16 text-right">{t("leaderboard.perUser")}</span>
      </div>
      {entries.map((entry, idx) => (
        <div key={entry.countryId}>
          <Link
            href={`/?country=${entry.countryId}`}
            className={`
              flex items-center gap-2 md:gap-3 px-2 md:px-4 py-2 md:py-3 rounded-lg transition-colors cursor-pointer
              ${
                entry.medal
                  ? "bg-background-surface border border-border hover:border-[#c9a84c]"
                  : "hover:bg-background-surface"
              }
              ${entry.rank > 8 ? "opacity-60" : ""}
            `}
          >
            <span className="text-sm text-foreground-subtle font-mono w-6 text-right">
              {entry.rank}
            </span>
            {entry.medal && <MedalBadge type={entry.medal} size="sm" />}
            <span className="text-lg">{entry.flagEmoji}</span>
            <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
              {entry.name}
            </span>
            <span className="text-xs text-foreground-subtle hidden sm:inline w-12 text-right">
              {entry.activeUsers ?? entry.totalCreators}
            </span>
            <span className="text-xs text-foreground-subtle hidden sm:inline w-14 text-right">
              {entry.totalScore.toLocaleString()}
            </span>
            <span className="text-sm font-mono text-[#c9a84c] w-16 text-right">
              {(entry.perUserScore ?? entry.totalScore).toLocaleString()}
            </span>
          </Link>
          {/* Top 8 qualification line */}
          {idx === 7 && entries.length > 8 && (
            <div className="flex items-center gap-2 my-1.5 mx-2">
              <div className="flex-1 border-t border-dashed border-[#c9a84c]/40" />
              <span className="text-[9px] text-[#c9a84c]/70 font-medium whitespace-nowrap">
                {t("leaderboard.qualificationLine")}
              </span>
              <div className="flex-1 border-t border-dashed border-[#c9a84c]/40" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

const CreatorTable = React.memo(function CreatorTable({ entries }: { entries: CreatorEntry[] }) {
  const { t } = useTranslation();
  if (entries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <Link
          key={entry.username}
          href={`/user/${entry.username}`}
          className={`
            flex items-center gap-2 md:gap-3 px-2 md:px-4 py-2 md:py-3 rounded-lg transition-colors cursor-pointer
            ${
              entry.medal
                ? "bg-background-surface border border-border hover:border-[#c9a84c]"
                : "hover:bg-background-surface"
            }
          `}
        >
          <span className="text-sm text-foreground-subtle font-mono w-6 text-right">
            {entry.rank}
          </span>
          {entry.medal && <MedalBadge type={entry.medal} size="sm" />}
          <Avatar
            src={entry.avatarUrl}
            alt={entry.username}
            size="sm"
            countryFlag={entry.countryFlag}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground truncate">
                {entry.displayName || entry.username}
              </span>
              {entry.tier && <TierBadge tier={entry.tier} size="xs" />}
            </div>
            <span className="text-xs text-foreground-subtle">@{entry.username}</span>
          </div>
          <span className="text-xs text-foreground-subtle hidden sm:inline">
            {entry.totalPosts} {t("leaderboard.posts")}
          </span>
          <span className="text-sm font-mono text-[#c9a84c]">
            {entry.totalScore.toLocaleString()}
          </span>
        </Link>
      ))}
    </div>
  );
});

const MemeTable = React.memo(function MemeTable({ entries }: { entries: MemeEntry[] }) {
  const { t } = useTranslation();
  if (entries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <Link
          key={entry.postId}
          href={`/post/${entry.postId}`}
          className={`
            flex items-center gap-2 md:gap-3 px-2 md:px-4 py-2 md:py-3 rounded-lg transition-colors cursor-pointer
            ${
              entry.medal
                ? "bg-background-surface border border-border hover:border-[#c9a84c]"
                : "hover:bg-background-surface"
            }
          `}
        >
          <span className="text-sm text-foreground-subtle font-mono w-6 text-right">
            {entry.rank}
          </span>
          {entry.medal && <MedalBadge type={entry.medal} size="sm" />}
          {entry.thumbnailUrl && (
            <img
              src={entry.thumbnailUrl}
              alt={entry.title}
              className="w-10 h-10 rounded object-cover bg-background-elevated"
            />
          )}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground truncate block">
              {entry.title}
            </span>
            <span className="text-xs text-foreground-subtle">
              @{entry.authorUsername}
            </span>
          </div>
          <span className="text-xs text-foreground-subtle hidden sm:inline">
            {entry.reactionCount} ⬆️
          </span>
          <span className="text-sm font-mono text-[#c9a84c]">
            {entry.totalScore.toLocaleString()}
          </span>
        </Link>
      ))}
    </div>
  );
});

function EmptyState() {
  const { t } = useTranslation();
  return (
    <p className="text-sm text-foreground-subtle text-center py-12">
      {t("leaderboard.noActivity")}
    </p>
  );
}
