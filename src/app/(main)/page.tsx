"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import FeedFilters from "@/components/feed/FeedFilters";
import FeedList from "@/components/feed/FeedList";
import MonthlyWinnerBanner from "@/components/competition/MonthlyWinnerBanner";

const TRANSLATE_LANGUAGES = [
  { code: "", label: "Original" },
  { code: "ko", label: "🇰🇷", full: "한국어" },
  { code: "en", label: "🇺🇸", full: "English" },
  { code: "ja", label: "🇯🇵", full: "日本語" },
  { code: "zh", label: "🇨🇳", full: "中文" },
  { code: "es", label: "🇲🇽", full: "Español" },
];

export default function HomePage() {
  const [translateTo, setTranslateTo] = useState("");

  return (
    <MainLayout>
      <div className="space-y-0">
        <MonthlyWinnerBanner />
        <FeedFilters />

        {/* Translation language selector */}
        <div className="flex items-center gap-2 px-0 pt-3 pb-1">
          <span className="text-xs text-foreground-subtle mr-1">
            <svg className="w-3.5 h-3.5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            Translate:
          </span>
          {TRANSLATE_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setTranslateTo(lang.code)}
              title={lang.full || lang.label}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                translateTo === lang.code
                  ? "bg-[#c9a84c]/20 text-[#c9a84c] border border-[#c9a84c]/40"
                  : "bg-background-elevated text-foreground-subtle border border-border hover:border-border-active hover:text-foreground-muted"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <div className="pt-2">
          <FeedList translateTo={translateTo} />
        </div>
      </div>
    </MainLayout>
  );
}
