"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";

interface ChampionshipBannerProps {
  phase: string | null;
  year?: number;
}

export default function ChampionshipBanner({ phase, year }: ChampionshipBannerProps) {
  const { t } = useTranslation();

  if (!phase || phase === "COMPLETED") return null;

  const getMessage = () => {
    switch (phase) {
      case "NOMINATION":
        return t("championship.banner.nomination");
      case "REPRESENTATIVE":
        return t("championship.banner.vote");
      case "UPLOAD":
        return t("championship.banner.upload");
      case "CHAMPIONSHIP":
        return t("championship.banner.battle");
      default:
        return t("championship.banner.active");
    }
  };

  return (
    <Link href="/championship">
      <div className="relative overflow-hidden rounded-xl border border-[#c9a84c]/30 bg-gradient-to-r from-[#c9a84c]/10 via-[#c9a84c]/5 to-transparent p-3 hover:border-[#c9a84c]/50 transition-all group cursor-pointer">
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c9a84c]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

        <div className="relative flex items-center gap-3">
          <span className="text-2xl">🏆</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#c9a84c]">
              {year} {t("championship.title")}
            </p>
            <p className="text-xs text-foreground-muted mt-0.5 truncate">
              {getMessage()}
            </p>
          </div>
          <svg
            className="w-5 h-5 text-[#c9a84c]/60 group-hover:text-[#c9a84c] group-hover:translate-x-1 transition-all"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
