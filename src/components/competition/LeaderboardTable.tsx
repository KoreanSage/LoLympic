"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import Avatar from "@/components/ui/Avatar";
import MedalBadge from "./MedalBadge";

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

  const tabs = [
    { id: "countries", label: "Countries", count: countries.length },
    { id: "creators", label: "Creators", count: creators.length },
    { id: "memes", label: "Memes", count: memes.length },
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

function CountryTable({ entries }: { entries: CountryEntry[] }) {
  if (entries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.countryId}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
            ${
              entry.medal
                ? "bg-background-surface border border-border"
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
            {entry.totalPosts} posts
          </span>
          <span className="text-xs text-foreground-subtle">
            {entry.totalCreators} creators
          </span>
          <span className="text-sm font-mono text-[#c9a84c]">
            {entry.totalScore.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function CreatorTable({ entries }: { entries: CreatorEntry[] }) {
  if (entries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.username}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
            ${
              entry.medal
                ? "bg-background-surface border border-border"
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
            {entry.totalPosts} posts
          </span>
          <span className="text-sm font-mono text-[#c9a84c]">
            {entry.totalScore.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function MemeTable({ entries }: { entries: MemeEntry[] }) {
  if (entries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.postId}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
            ${
              entry.medal
                ? "bg-background-surface border border-border"
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
              by @{entry.authorUsername}
            </span>
          </div>
          <span className="text-xs text-foreground-subtle">
            {entry.reactionCount} reactions
          </span>
          <span className="text-sm font-mono text-[#c9a84c]">
            {entry.totalScore.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <p className="text-sm text-foreground-subtle text-center py-12">
      No entries yet for this season.
    </p>
  );
}
