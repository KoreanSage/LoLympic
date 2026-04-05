"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import MainLayout from "@/components/layout/MainLayout";
import { useTranslation } from "@/i18n";

interface ChampionData {
  season: {
    id: string;
    name: string;
    number: number;
    startAt: string;
    endAt: string;
    championPostId: string | null;
  };
  champion: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  country: {
    id: string;
    nameEn: string;
    flagEmoji: string;
  } | null;
  post: {
    id: string;
    title: string;
    images: { originalUrl: string }[];
  } | null;
}

export default function HallOfFamePage() {
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    fetch("/api/seasons?all=true")
      .then((r) => r.json())
      .then(async (data) => {
        const completedSeasons = (data.seasons || []).filter(
          (s: { status: string; championUserId?: string }) =>
            (s.status === "COMPLETED" || s.status === "ARCHIVED") && s.championUserId
        );

        // Fetch champion details for each season
        const champData: ChampionData[] = await Promise.all(
          completedSeasons.map(async (s: {
            id: string;
            name: string;
            number: number;
            startAt: string;
            endAt: string;
            championUserId: string;
            championCountryId: string | null;
            championPostId: string | null;
          }) => {
            try {
              const [userRes, postRes] = await Promise.all([
                fetch(`/api/users/${s.championUserId}`).catch(() => null),
                s.championPostId
                  ? fetch(`/api/posts/${s.championPostId}`).catch(() => null)
                  : null,
              ]);

              const user = userRes?.ok ? await userRes.json() : null;
              const postData = postRes?.ok ? await postRes.json() : null;

              // Use country data from user profile if available, otherwise fallback
              const countryData = user?.country
                ? { id: user.country.id, nameEn: user.country.nameEn, flagEmoji: user.country.flagEmoji }
                : s.championCountryId
                  ? { id: s.championCountryId, nameEn: "", flagEmoji: "" }
                  : null;

              return {
                season: {
                  id: s.id,
                  name: s.name,
                  number: s.number,
                  startAt: s.startAt,
                  endAt: s.endAt,
                  championPostId: s.championPostId,
                },
                champion: user,
                country: countryData,
                post: postData?.post || null,
              } as ChampionData;
            } catch {
              return {
                season: s,
                champion: null,
                country: null,
                post: null,
              } as ChampionData;
            }
          })
        );

        setChampions(champData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <MainLayout showSidebar={false}>
        <div className="max-w-3xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-background-elevated rounded w-48 mx-auto" />
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-48 bg-background-elevated rounded-xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          <span className="text-[#c9a84c]">{t("hallOfFame.title").split(" ")[0]}</span> {t("hallOfFame.title").split(" ").slice(1).join(" ")}
        </h1>
        <p className="text-sm text-foreground-subtle">
          {t("hallOfFame.subtitle")}
        </p>
      </div>

      {champions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🏛️</p>
          <p className="text-foreground-muted">{t("hallOfFame.noChampions")}</p>
          <p className="text-sm text-foreground-subtle mt-1">
            {t("hallOfFame.firstChampion")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {champions.map((data) => (
            <div
              key={data.season.id}
              className="relative bg-background-surface border border-[#c9a84c]/30 rounded-2xl overflow-hidden"
            >
              {/* Gold top accent */}
              <div className="h-1.5 bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

              <div className="p-6">
                {/* Season label */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{data.season.name}</h2>
                    <p className="text-xs text-foreground-subtle">
                      {new Date(data.season.startAt).getFullYear()}
                    </p>
                  </div>
                  <span className="text-4xl">🏆</span>
                </div>

                <div className="flex items-center gap-6">
                  {/* Champion meme thumbnail */}
                  {data.post?.images?.[0]?.originalUrl && (
                    <Link
                      href={`/post/${data.post.id}`}
                      className="w-32 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-border hover:border-[#c9a84c]/50 transition-colors"
                    >
                      <img
                        src={data.post.images[0].originalUrl}
                        alt={data.post.title || "Champion meme"}
                        className="w-full h-full object-cover"
                      />
                    </Link>
                  )}

                  {/* Champion info */}
                  <div className="flex-1">
                    {data.post && (
                      <Link
                        href={`/post/${data.post.id}`}
                        className="text-sm font-medium text-foreground hover:text-[#c9a84c] transition-colors"
                      >
                        {data.post.title}
                      </Link>
                    )}

                    {data.champion && (
                      <div className="flex items-center gap-3 mt-3">
                        <Avatar
                          src={data.champion.avatarUrl}
                          alt={data.champion.displayName || data.champion.username}
                          size="lg"
                          isChampion={true}
                        />
                        <div>
                          <Link
                            href={`/user/${data.champion.username}`}
                            className="text-sm font-semibold text-foreground hover:text-[#c9a84c] transition-colors"
                          >
                            {data.champion.displayName || data.champion.username}
                          </Link>
                          {data.country && (
                            <p className="text-xs text-foreground-subtle mt-0.5">
                              {data.country.flagEmoji} {data.country.nameEn}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </MainLayout>
  );
}
