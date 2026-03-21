"use client";

import { useSession } from "next-auth/react";
import MainLayout from "@/components/layout/MainLayout";
import FeedFilters from "@/components/feed/FeedFilters";
import FeedList from "@/components/feed/FeedList";
import MonthlyWinnerBanner from "@/components/competition/MonthlyWinnerBanner";
import WinnerPopup from "@/components/competition/WinnerPopup";

export default function HomePage() {
  const { data: session } = useSession();
  const translateTo = (session?.user as any)?.preferredLanguage || "";

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
