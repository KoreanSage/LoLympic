"use client";

import React, { useState } from "react";
import Link from "next/link";
import Tabs from "@/components/ui/Tabs";
import Avatar from "@/components/ui/Avatar";
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

      <div className="mt-4">
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
      {entries.map((entry) => (
        <Link
          key={entry.countryId}
          href={`/search?q=${encodeURIComponent(entry.name)}`}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer
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
          <span className="text-lg">{entry.flagEmoji}</span>
          <span className="text-sm font-medium text-foreground flex-1">
            {entry.name}
          </span>
          <span className="text-xs text-foreground-subtle">
            {entry.totalPosts} {t("leaderboard.posts")}
          </span>
          <span className="text-xs text-foreground-subtle">
            {entry.totalCreators} {t("leaderboard.creators")}
          </span>
          <span className="text-sm font-mono text-[#c9a84c]">
            {entry.totalScore.toLocaleString()}
          </span>
        </Link>
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
            flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer
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
            <span className="text-sm font-medium text-foreground truncate block">
              {entry.displayName || entry.username}
            </span>
            <span className="text-xs text-foreground-subtle">@{entry.username}</span>
          </div>
          <span className="text-xs text-foreground-subtle">
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
            flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer
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
          <span className="text-xs text-foreground-subtle">
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
