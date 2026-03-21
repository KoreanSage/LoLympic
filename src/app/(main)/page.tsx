"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import MainLayout from "@/components/layout/MainLayout";
import FeedFilters from "@/components/feed/FeedFilters";
import FeedList from "@/components/feed/FeedList";
import MonthlyWinnerBanner from "@/components/competition/MonthlyWinnerBanner";
import WinnerPopup from "@/components/competition/WinnerPopup";

export default function HomePage() {
  const { data: session } = useSession();
  const [freshLang, setFreshLang] = useState<string | null>(null);

  // Get the user's ACTUAL preferredLanguage: localStorage (instant) > DB > session JWT
  useEffect(() => {
    // Check localStorage first (set by settings page on save)
    const stored = localStorage.getItem("lolympic_preferredLanguage");
    if (stored) {
      setFreshLang(stored);
    }
    // Then verify from DB for accuracy
    if (!session?.user) return;
    fetch("/api/users/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.preferredLanguage) {
          setFreshLang(data.preferredLanguage);
          localStorage.setItem("lolympic_preferredLanguage", data.preferredLanguage);
        }
      })
      .catch(() => {});
  }, [session?.user]);

  const translateTo = freshLang || (session?.user as any)?.preferredLanguage || "";

  return (
    <MainLayout>
      <WinnerPopup />
      <div className="space-y-0">
        <MonthlyWinnerBanner />
        <FeedFilters />

        <div className="pt-2">
          <FeedList translateTo={translateTo} />
        </div>
      </div>
    </MainLayout>
  );
}
