"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { useTranslation } from "@/i18n";

interface CandidateCardProps {
  candidate: {
    id: string;
    userId: string;
    countryId: string;
    rank: number;
    status: string;
    seasonScore: number;
    voteCount: number;
    autoElected: boolean;
    user: {
      id: string;
      username: string;
      displayName?: string | null;
      avatarUrl?: string | null;
    };
    country: {
      id: string;
      nameEn: string;
      flagEmoji: string;
    };
  };
  canVote: boolean;
  hasVotedInCountry: boolean;
  isMyCountry: boolean;
  onVote?: (candidateId: string) => void;
  voting?: boolean;
}

export default function CandidateCard({
  candidate,
  canVote,
  hasVotedInCountry,
  isMyCountry,
  onVote,
  voting = false,
}: CandidateCardProps) {
  const { t } = useTranslation();

  const statusBadge = () => {
    switch (candidate.status) {
      case "ELECTED":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30">
            {t("championship.elected")}
          </span>
        );
      case "RUNNER_UP":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-foreground-subtle/10 text-foreground-subtle">
            {t("championship.runnerUp")}
          </span>
        );
      case "ELIMINATED":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400">
            {t("championship.eliminated")}
          </span>
        );
      case "SUBSTITUTE":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400">
            {t("championship.substitute")}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        isMyCountry
          ? "border-[#c9a84c]/40 bg-[#c9a84c]/5"
          : "border-border bg-background-surface"
      } ${candidate.status === "ELECTED" ? "ring-1 ring-[#c9a84c]/20" : ""}`}
    >
      {/* Rank badge */}
      <div className="absolute -top-2.5 -left-2 w-6 h-6 rounded-full bg-background-surface border border-border flex items-center justify-center">
        <span className="text-[11px] font-bold text-foreground-muted">#{candidate.rank}</span>
      </div>

      {/* Auto-elected indicator */}
      {candidate.autoElected && (
        <div className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#c9a84c] text-black">
          AUTO
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link href={`/user/${candidate.user.username}`}>
          <Avatar
            src={candidate.user.avatarUrl}
            alt={candidate.user.displayName || candidate.user.username}
            size="md"
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/user/${candidate.user.username}`}
              className="text-sm font-semibold text-foreground hover:text-[#c9a84c] transition-colors truncate"
            >
              {candidate.user.displayName || `@${candidate.user.username}`}
            </Link>
            {statusBadge()}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm">{candidate.country.flagEmoji}</span>
            <span className="text-xs text-foreground-subtle">{candidate.country.nameEn}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-foreground-subtle">
              {t("championship.seasonScore")}: <strong className="text-[#c9a84c]">{candidate.seasonScore.toLocaleString()}</strong>
            </span>
            <span className="text-[11px] text-foreground-subtle">
              {t("championship.votes")}: <strong>{candidate.voteCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Vote button */}
      {canVote && !hasVotedInCountry && candidate.status === "NOMINATED" && (
        <button
          onClick={() => onVote?.(candidate.id)}
          disabled={voting}
          className="mt-3 w-full py-2 rounded-lg text-sm font-medium bg-[#c9a84c] text-black hover:bg-[#b8963f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {voting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              {t("championship.voting")}
            </span>
          ) : (
            t("championship.voteFor")
          )}
        </button>
      )}

      {hasVotedInCountry && (
        <p className="mt-2 text-center text-[11px] text-foreground-subtle">
          {t("championship.alreadyVoted")}
        </p>
      )}
    </div>
  );
}
