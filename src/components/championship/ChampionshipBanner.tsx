"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";

interface ChampionshipBannerProps {
  phase: string | null;
  year?: number;
  qualifiedCountries?: Array<{ flagEmoji: string }>;
}

const BANNER_DISMISS_KEY = "mimzy_championship_banner_dismissed";

export default function ChampionshipBanner({ phase, year, qualifiedCountries }: ChampionshipBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BANNER_DISMISS_KEY);
      if (stored === String(year)) setDismissed(true);
    } catch {}
  }, [year]);

  if (!phase || phase === "COMPLETED" || dismissed) return null;

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

  const getCta = () => {
    switch (phase) {
      case "REPRESENTATIVE":
        return t("championship.banner.ctaVote");
      case "CHAMPIONSHIP":
        return t("championship.banner.ctaBattle");
      default:
        return t("championship.banner.ctaView");
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, String(year));
    } catch {}
  };

  // Mini phase indicators
  const phases = ["NOMINATION", "REPRESENTATIVE", "UPLOAD", "CHAMPIONSHIP", "COMPLETED"];
  const currentIdx = phases.indexOf(phase || "");

  return (
    <Link href="/championship">
      <div className="relative overflow-hidden rounded-xl border border-[#c9a84c]/30 bg-gradient-to-r from-[#c9a84c]/10 via-[#c9a84c]/5 to-transparent p-3 hover:border-[#c9a84c]/50 transition-all group cursor-pointer">
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c9a84c]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#c9a84c]">
                {year} {t("championship.title")}
              </p>
              <p className="text-xs text-foreground-muted mt-0.5 truncate">
                {getMessage()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/30">
                {getCta()}
              </span>
              <svg
                className="w-4 h-4 text-[#c9a84c]/60 group-hover:text-[#c9a84c] group-hover:translate-x-1 transition-all"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Mini timeline */}
          <div className="flex items-center gap-1 mt-2 ml-9">
            {phases.slice(0, -1).map((p, i) => (
              <div key={p} className="flex items-center">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  i < currentIdx ? "bg-[#c9a84c]" : i === currentIdx ? "bg-[#c9a84c] ring-2 ring-[#c9a84c]/30" : "bg-border"
                }`} />
                {i < phases.length - 2 && (
                  <div className={`w-4 h-px ${i < currentIdx ? "bg-[#c9a84c]/50" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Qualified country flags */}
          {qualifiedCountries && qualifiedCountries.length > 0 && (
            <div className="flex items-center gap-0.5 mt-2 ml-9">
              {qualifiedCountries.slice(0, 8).map((c, i) => (
                <span key={i} className="text-xs">{c.flagEmoji}</span>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-background-surface/80 flex items-center justify-center text-foreground-subtle hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Link>
  );
}
