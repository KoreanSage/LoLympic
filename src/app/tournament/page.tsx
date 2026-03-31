"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";

/**
 * Tournament has been replaced by the Championship system.
 * This page redirects users to the new Championship page.
 */
export default function TournamentPage() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // Auto-redirect after a short delay
    const timer = setTimeout(() => {
      router.replace("/championship");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <span className="text-5xl mb-4 block">🏆</span>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t("tournament.movedToChampionship")}
        </h1>
        <p className="text-sm text-foreground-subtle mb-6">
          {t("tournament.movedDesc")}
        </p>
        <Link
          href="/championship"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#c9a84c] text-black font-medium text-sm hover:bg-[#b8963f] transition-colors"
        >
          {t("tournament.goToChampionship")}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <p className="text-xs text-foreground-subtle mt-4">
          {t("tournament.autoRedirect")}
        </p>
      </div>
    </MainLayout>
  );
}
