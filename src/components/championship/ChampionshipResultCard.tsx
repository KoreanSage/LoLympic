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

  const podiumConfig: Record<number, {
    medal: string;
    bg: string;
    border: string;
    glow: string;
    height: string;
    labelKey: string;
    scale: string;
  }> = {
    1: {
      medal: "1st",
      bg: "bg-gradient-to-b from-[#c9a84c]/20 to-[#c9a84c]/5",
      border: "border-[#c9a84c]/50",
      glow: "shadow-[0_0_30px_rgba(201,168,76,0.3)]",
      height: "h-28 sm:h-36",
      labelKey: "championship.champion",
      scale: "scale-105",
    },
    2: {
      medal: "2nd",
      bg: "bg-gradient-to-b from-gray-400/15 to-gray-400/5",
      border: "border-gray-400/30",
      glow: "",
      height: "h-20 sm:h-24",
      labelKey: "championship.secondPlace",
      scale: "",
    },
    3: {
      medal: "3rd",
      bg: "bg-gradient-to-b from-amber-700/15 to-amber-700/5",
      border: "border-amber-700/30",
      glow: "",
      height: "h-16 sm:h-20",
      labelKey: "championship.thirdPlace",
      scale: "",
    },
  };

  return (
    <div>
      {/* Podium */}
      <div className="flex items-end justify-center gap-2 sm:gap-4 mb-8 px-2">
        {podiumOrder.map((entry) => {
          const rank = entry.rank!;
          const config = podiumConfig[rank as 1 | 2 | 3];
          const imageUrl = entry.post.images[0]?.originalUrl;
          const isChampion = rank === 1;

          return (
            <div
              key={entry.championshipPostId}
              className={`flex flex-col items-center transition-all ${
                rank === 1 ? "order-2" : rank === 2 ? "order-1" : "order-3"
              } ${config.scale}`}
            >
              {/* Medal */}
              <span className={`mb-1 font-bold ${isChampion ? "text-xl text-[#c9a84c]" : "text-base sm:text-lg text-foreground-muted"}`}>
                {config.medal}
              </span>

              {/* Avatar with crown for champion */}
              <div className="relative mb-1">
                <div className={`${isChampion ? "ring-2 ring-[#c9a84c] ring-offset-2 ring-offset-background" : ""} rounded-full`}>
                  <Avatar
                    src={entry.user.avatarUrl}
                    alt={entry.user.displayName || entry.user.username}
                    size={isChampion ? "lg" : "md"}
                  />
                </div>
                {isChampion && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#c9a84c] bg-[#c9a84c]/15 rounded-full w-5 h-5 flex items-center justify-center border border-[#c9a84c]/30">
                    ★
                  </div>
                )}
              </div>

              {/* Country flag */}
              <span className="text-xl">{entry.country.flagEmoji}</span>

              {/* Name */}
              <Link
                href={`/user/${entry.user.username}`}
                className={`text-xs font-semibold hover:text-[#c9a84c] transition-colors mt-1 text-center truncate ${
                  isChampion ? "text-[#c9a84c] max-w-[120px]" : "text-foreground max-w-[100px]"
                }`}
              >
                {entry.user.displayName || `@${entry.user.username}`}
              </Link>

              {/* Country name */}
              <p className="text-[10px] text-foreground-subtle">{entry.country.nameEn}</p>

              {/* Votes */}
              <p className={`text-xs font-bold mt-1 ${isChampion ? "text-[#c9a84c]" : "text-foreground-muted"}`}>
                {entry.battleVoteCount} {t("championship.votes")}
              </p>

              {/* Label */}
              <p className={`text-[10px] font-bold mt-0.5 ${
                isChampion ? "text-[#c9a84c] uppercase tracking-wider" : "text-foreground-subtle"
              }`}>
                {t(config.labelKey as never)}
              </p>

              {/* Podium bar with post image */}
              <div className={`w-20 sm:w-28 ${config.height} ${config.bg} border-t-2 ${config.border} ${config.glow} rounded-t-lg mt-2 flex items-center justify-center overflow-hidden`}>
                {imageUrl && (
                  <Link href={`/post/${entry.postId}`} className="w-full h-full flex items-center justify-center p-1.5">
                    <img
                      src={imageUrl}
                      alt={entry.post.title}
                      className="max-w-full max-h-full rounded-lg object-cover hover:scale-105 transition-transform"
                    />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Full rankings table (4th-8th place) */}
      {rest.length > 0 && (
        <div className="bg-background-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground-muted">
              {t("championship.otherRankings")}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {rest.map((entry) => (
              <div
                key={entry.championshipPostId}
                className="flex items-center gap-3 px-4 py-3 hover:bg-background-elevated transition-colors"
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
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/user/${entry.user.username}`}
                    className="text-xs font-medium text-foreground hover:text-[#c9a84c] transition-colors truncate block"
                  >
                    {entry.user.displayName || `@${entry.user.username}`}
                  </Link>
                  <span className="text-[10px] text-foreground-subtle">{entry.country.nameEn}</span>
                </div>
                <span className="text-xs font-bold text-[#c9a84c]">
                  {entry.battleVoteCount} {t("championship.votes")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
