"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";

const DISMISS_KEY = "lolympic_hero_dismissed";

export default function HeroBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(true); // default hidden until checked

  useEffect(() => {
    const val = localStorage.getItem(DISMISS_KEY);
    setDismissed(val === "true");
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="relative bg-gradient-to-r from-[#c9a84c]/10 to-[#c9a84c]/5 border border-[#c9a84c]/30 rounded-xl p-5 animate-in fade-in duration-500">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-foreground-subtle hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <div className="text-center space-y-2 pr-4">
        <h2 className="text-lg font-bold text-foreground">
          {t("hero.tagline")}
        </h2>
        <p className="text-sm text-foreground-muted">
          {t("hero.subtitle")}
        </p>
        <Link
          href="/upload"
          className="inline-block mt-2 px-5 py-2 rounded-xl bg-[#c9a84c] text-white text-sm font-semibold hover:bg-[#b8973f] transition-colors"
        >
          {t("hero.cta")}
        </Link>
      </div>
    </div>
  );
}
