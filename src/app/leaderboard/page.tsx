"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import LeaderboardTable from "@/components/competition/LeaderboardTable";
import SeasonBar from "@/components/competition/SeasonBar";

// ---------------------------------------------------------------------------
// Types matching the API response shapes
// ---------------------------------------------------------------------------

interface ApiCountryEntry {
  rank: number;
  country: { id: string; nameEn: string; flagEmoji: string };
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
  totalPosts: number;
  totalCreators: number;
}

interface ApiCreatorEntry {
  rank: number;
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  country: { flagEmoji: string } | null;
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
  totalPosts: number;
}

interface ApiMemeEntry {
  rank: number;
  post: {
    id: string;
    title: string;
    author: { username: string };
    images: Array<{ originalUrl: string }>;
    reactionCount: number;
  };
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
}

interface ApiLeaderboardResponse {
  type: string;
  seasonId: string | null;
  entries: unknown[];
  message?: string;
}

// ---------------------------------------------------------------------------
// Mappers: API response -> LeaderboardTable prop format
// ---------------------------------------------------------------------------

function mapCountries(entries: ApiCountryEntry[]) {
  return entries.map((e) => ({
    rank: e.rank,
    countryId: e.country.id,
    flagEmoji: e.country.flagEmoji,
    name: e.country.nameEn,
    totalScore: e.score,
    medal: e.medal ?? undefined,
    totalPosts: e.totalPosts,
    totalCreators: e.totalCreators,
  }));
}

function mapCreators(entries: ApiCreatorEntry[]) {
  return entries.map((e) => ({
    rank: e.rank,
    username: e.user.username,
    displayName: e.user.displayName,
    avatarUrl: e.user.avatarUrl,
    countryFlag: e.country?.flagEmoji,
    totalScore: e.score,
    medal: e.medal ?? undefined,
    totalPosts: e.totalPosts,
  }));
}

function mapMemes(entries: ApiMemeEntry[]) {
  return entries.map((e) => ({
    rank: e.rank,
    postId: e.post.id,
    title: e.post.title,
    thumbnailUrl: e.post.images?.[0]?.originalUrl,
    authorUsername: e.post.author.username,
    totalScore: e.score,
    medal: e.medal ?? undefined,
    reactionCount: e.post.reactionCount ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<ReturnType<typeof mapCountries>>(
    []
  );
  const [creators, setCreators] = useState<ReturnType<typeof mapCreators>>([]);
  const [memes, setMemes] = useState<ReturnType<typeof mapMemes>>([]);
  const [empty, setEmpty] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const [battleMemes, setBattleMemes] = useState<
    Array<{
      id: string;
      title: string;
      imageUrl: string;
      battleWins: number;
      battleLosses: number;
      author: { username: string; displayName: string | null };
      country: { flagEmoji: string } | null;
    }>
  >([]);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [countryRes, creatorRes, memeRes, battleRes] = await Promise.all([
          fetch("/api/leaderboard?type=country"),
          fetch("/api/leaderboard?type=creator"),
          fetch("/api/leaderboard?type=meme"),
          fetch("/api/leaderboard?type=battle&limit=5"),
        ]);

        const countryData: ApiLeaderboardResponse = await countryRes.json();
        const creatorData: ApiLeaderboardResponse = await creatorRes.json();
        const memeData: ApiLeaderboardResponse = await memeRes.json();
        const battleData = await battleRes.json().catch(() => ({ entries: [] }));

        // Check if data is from realtime fallback
        if ((countryData as any).source === "realtime") {
          setIsRealtime(true);
        }

        const mappedCountries = mapCountries(
          (countryData.entries ?? []) as ApiCountryEntry[]
        );
        const mappedCreators = mapCreators(
          (creatorData.entries ?? []) as ApiCreatorEntry[]
        );
        const mappedMemes = mapMemes(
          (memeData.entries ?? []) as ApiMemeEntry[]
        );

        setCountries(mappedCountries);
        setCreators(mappedCreators);
        setMemes(mappedMemes);
        if (battleData.entries?.length > 0) {
          setBattleMemes(battleData.entries);
        }

        if (
          mappedCountries.length === 0 &&
          mappedCreators.length === 0 &&
          mappedMemes.length === 0
        ) {
          setEmpty(true);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard data:", err);
        setEmpty(true);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  return (
    <MainLayout showSidebar={false}>
      <div className="py-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {t("leaderboard.title")}
          </h1>
          <p className="text-sm text-foreground-subtle">
            {isRealtime ? "All-time rankings based on community activity" : "Global rankings for the current season"}
          </p>
        </div>

        {isRealtime && !loading && !empty && (
          <div className="mx-auto max-w-md bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl px-4 py-2.5 text-center">
            <p className="text-xs text-[#c9a84c]">
              📊 Live rankings from all-time activity — season rankings coming soon!
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-border-active border-t-[#c9a84c] rounded-full animate-spin" />
          </div>
        ) : empty ? (
          <div className="text-center py-20">
            <p className="text-lg mb-2">🎮</p>
            <p className="text-sm text-foreground-subtle">No activity yet — post a meme to get on the board!</p>
          </div>
        ) : (
          <>
          {battleMemes.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-bold text-[#c9a84c] mb-3 flex items-center gap-2">
                <span>⚔️</span> {t("battle.hotBattle")}
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {battleMemes.map((meme: any, i: number) => (
                  <div
                    key={meme.id}
                    className="flex-shrink-0 w-32 rounded-xl overflow-hidden border border-border bg-background-surface"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={meme.imageUrl}
                      alt={meme.title}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="p-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        {meme.country && (
                          <span className="text-xs">{meme.country.flagEmoji}</span>
                        )}
                        <span className="text-[10px] text-foreground-muted truncate">
                          {meme.author?.displayName || meme.author?.username}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#c9a84c] font-medium">
                        ⚔️ {meme.battleWins}W / {meme.battleLosses}L
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <LeaderboardTable
            countries={countries}
            creators={creators}
            memes={memes}
          />
          </>
        )}
      </div>
    </MainLayout>
  );
}
