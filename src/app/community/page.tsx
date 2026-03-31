"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import FeedList from "@/components/feed/FeedList";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";

interface CountryEntry {
  country: { id: string; nameEn: string; flagEmoji: string };
  totalCreators: number;
}

export default function CommunityPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [countries, setCountries] = useState<CountryEntry[]>([]);
  const [tab, setTab] = useState<"boards" | "discussion">("discussion");
  const [freshLang, setFreshLang] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("mimzy_preferredLanguage");
      if (stored) setFreshLang(stored);
    }
  }, []);

  useEffect(() => {
    fetch("/api/leaderboard?type=country&limit=20")
      .then((r) => r.json())
      .then((data) => setCountries(data.entries ?? []))
      .catch(() => {});
  }, []);

  const translateTo = freshLang || session?.user?.preferredLanguage || "";

  return (
    <MainLayout>
      <div className="space-y-4 py-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">{t("community.title")}</h1>
          <p className="text-sm text-foreground-subtle">{t("community.subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-background-surface rounded-lg p-0.5 border border-border mx-auto w-fit">
          <button
            onClick={() => setTab("discussion")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === "discussion"
                ? "bg-background-overlay text-foreground"
                : "text-foreground-subtle hover:text-foreground-muted"
            }`}
          >
            💬 {t("community.discussion")}
          </button>
          <button
            onClick={() => setTab("boards")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === "boards"
                ? "bg-background-overlay text-foreground"
                : "text-foreground-subtle hover:text-foreground-muted"
            }`}
          >
            🌍 {t("community.countryBoards")}
          </button>
        </div>

        {/* Discussion tab */}
        {tab === "discussion" && (
          <div>
            <FeedList
              translateTo={translateTo}
              filters={{ postType: "community", sort: "recent" }}
              emptyMessage={t("community.emptyDiscussion")}
            />
          </div>
        )}

        {/* Country boards tab */}
        {tab === "boards" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {countries.map((entry) => (
              <Link
                key={entry.country.id}
                href={`/country/${entry.country.id}/board`}
                className="flex flex-col items-center p-4 rounded-xl border border-border bg-background-surface hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5 transition-all"
              >
                <span className="text-3xl mb-2">{entry.country.flagEmoji}</span>
                <span className="text-sm font-medium text-foreground text-center">{entry.country.nameEn}</span>
                <span className="text-[10px] text-foreground-subtle mt-0.5">
                  {entry.totalCreators} {t("community.members")}
                </span>
              </Link>
            ))}
            {countries.length === 0 && (
              <div className="col-span-full text-center py-12 text-sm text-foreground-subtle">
                {t("community.noCountries")}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
