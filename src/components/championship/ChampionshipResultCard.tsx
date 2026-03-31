"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { useTranslation } from "@/i18n";

interface ResultEntry {
  rank: number | null;
  championshipPostId: string;
  postId: string;
  battleVoteCount: number;
  post: {
    id: string;
    title: string;
    images: Array<{ originalUrl: string }>;
    reactionCount: number;
  };
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
}

interface ChampionshipResultCardProps {
  rankings: ResultEntry[];
  championUserId?: string | null;
}

const PODIUM_STYLES = {
  1: {
    medal: "\u{1F947}",
    bg: "bg-gradient-to-b from-[#c9a84c]/20 to-[#c9a84c]/5",
    border: "border-[#c9a84c]/40",
    ring: "ring-2 ring-[#c9a84c]/30",
    height: "h-32",
    label: "CHAMPION",
  },
  2: {
    medal: "\u{1F948}",
    bg: "bg-gradient-to-b from-gray-400/10 to-gray-400/5",
    border: "border-gray-400/30",
    ring: "",
    height: "h-24",
    label: "2nd Place",
  },
  3: {
    medal: "\u{1F949}",
    bg: "bg-gradient-to-b from-amber-700/10 to-amber-700/5",
    border: "border-amber-700/30",
    ring: "",
    height: "h-20",
    label: "3rd Place",
  },
};

export default function ChampionshipResultCard({ rankings, championUserId }: ChampionshipResultCardProps) {
  const { t } = useTranslation();

  const top3 = rankings.filter((r) => r.rank && r.rank <= 3);
  const rest = rankings.filter((r) => r.rank && r.rank > 3);

  // Reorder for podium: 2nd, 1st, 3rd
  const podiumOrder = [
    top3.find((r) => r.rank === 2),
    top3.find((r) => r.rank === 1),
    top3.find((r) => r.rank === 3),
  ].filter(Boolean) as ResultEntry[];

  return (
    <div>
      {/* Podium */}
      <div className="flex items-end justify-center gap-3 mb-8">
        {podiumOrder.map((entry) => {
          const rank = entry.rank!;
          const style = PODIUM_STYLES[rank as 1 | 2 | 3];
          const imageUrl = entry.post.images[0]?.originalUrl;

          return (
            <div
              key={entry.championshipPostId}
              className={`flex flex-col items-center ${rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3"}`}
            >
              {/* Medal */}
              <span className={`text-3xl mb-2 ${rank === 1 ? "text-4xl animate-bounce" : ""}`}>
                {style.medal}
              </span>

              {/* Avatar */}
              <div className={`relative ${rank === 1 ? "mb-1" : ""}`}>
                <Avatar
                  src={entry.user.avatarUrl}
                  alt={entry.user.displayName || entry.user.username}
                  size={rank === 1 ? "lg" : "md"}
                />
                {rank === 1 && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#c9a84c] flex items-center justify-center text-xs">
                    👑
                  </div>
                )}
              </div>

              {/* Country flag */}
              <span className="text-xl mt-1">{entry.country.flagEmoji}</span>

              {/* Name */}
              <Link
                href={`/user/${entry.user.username}`}
                className="text-xs font-semibold text-foreground hover:text-[#c9a84c] transition-colors mt-1 text-center max-w-[100px] truncate"
              >
                {entry.user.displayName || `@${entry.user.username}`}
              </Link>

              {/* Country */}
              <p className="text-[10px] text-foreground-subtle">{entry.country.nameEn}</p>

              {/* Votes */}
              <p className="text-xs font-bold text-[#c9a84c] mt-1">
                🔥 {entry.battleVoteCount}
              </p>

              {/* Label */}
              <p className={`text-[10px] font-bold mt-1 ${
                rank === 1 ? "text-[#c9a84c]" : "text-foreground-subtle"
              }`}>
                {style.label}
              </p>

              {/* Podium bar */}
              <div className={`w-24 sm:w-28 ${style.height} ${style.bg} border-t-2 ${style.border} ${style.ring} rounded-t-lg mt-2 flex items-center justify-center`}>
                {imageUrl && (
                  <Link href={`/post/${entry.postId}`}>
                    <img
                      src={imageUrl}
                      alt={entry.post.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover hover:scale-105 transition-transform"
                    />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest of rankings */}
      {rest.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground-muted mb-3">
            {t("championship.otherRankings")}
          </h3>
          {rest.map((entry) => (
            <div
              key={entry.championshipPostId}
              className="flex items-center gap-3 p-2 rounded-lg bg-background-surface border border-border"
            >
              <span className="text-xs font-bold text-foreground-subtle w-6 text-center">
                #{entry.rank}
              </span>
              <span className="text-lg">{entry.country.flagEmoji}</span>
              <Avatar
                src={entry.user.avatarUrl}
                alt={entry.user.displayName || entry.user.username}
                size="xs"
              />
              <Link
                href={`/user/${entry.user.username}`}
                className="text-xs font-medium text-foreground hover:text-[#c9a84c] transition-colors flex-1 truncate"
              >
                {entry.user.displayName || `@${entry.user.username}`}
              </Link>
              <span className="text-xs text-foreground-subtle">{entry.country.nameEn}</span>
              <span className="text-xs font-bold text-[#c9a84c]">🔥 {entry.battleVoteCount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
