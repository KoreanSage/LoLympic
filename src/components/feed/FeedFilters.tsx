"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";
import type { Locale } from "@/i18n/provider";
import { fetchCurrentUser } from "@/lib/user-cache";

interface FilterOption {
  value: string;
  label: string;
}

interface FeedFiltersProps {
  onFilterChange?: (filters: {
    country?: string;
    language?: string;
    category?: string;
    postType?: string;
    sort: string;
  }) => void;
  className?: string;
}

const UI_LANGS = [
  { code: "en", flag: "\u{1F1FA}\u{1F1F8}", name: "English" },
  { code: "ko", flag: "\u{1F1F0}\u{1F1F7}", name: "\uD55C\uAD6D\uC5B4" },
  { code: "ja", flag: "\u{1F1EF}\u{1F1F5}", name: "\u65E5\u672C\u8A9E" },
  { code: "zh", flag: "\u{1F1E8}\u{1F1F3}", name: "\u4E2D\u6587" },
  { code: "es", flag: "\u{1F1EA}\u{1F1F8}", name: "Espa\u00F1ol" },
  { code: "hi", flag: "\u{1F1EE}\u{1F1F3}", name: "\u0939\u093F\u0928\u094D\u0926\u0940" },
  { code: "ar", flag: "\u{1F1F8}\u{1F1E6}", name: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629" },
];

export default function FeedFilters({
  onFilterChange,
  className = "",
}: FeedFiltersProps) {
  const { t, locale, setLocale } = useTranslation();
  const { data: session } = useSession();
  const [sort, setSort] = useState("trending");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");

  useEffect(() => {
    if (!session?.user) return;
    fetchCurrentUser().catch(() => {});
  }, [session?.user]);

  const handleLocaleChange = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("uiLanguage", newLocale);
    localStorage.setItem("mimzy_preferredLanguage", newLocale);
    window.dispatchEvent(new StorageEvent("storage", { key: "mimzy_preferredLanguage", newValue: newLocale }));
    fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredLanguage: newLocale }),
    }).catch(() => {});
  }, [setLocale]);

  const SORT_OPTIONS: FilterOption[] = [
    { value: "trending", label: t("filter.trending") },
    { value: "recent", label: t("filter.recent") },
    { value: "top", label: t("filter.top") },
    ...(session?.user ? [{ value: "following", label: t("feed.following") }] : []),
  ];

  const COUNTRY_OPTIONS: FilterOption[] = [
    { value: "", label: "\u{1F30D} " + t("filter.allCountries") },
    { value: "KR", label: "\u{1F1F0}\u{1F1F7} " + t("filter.korea") },
    { value: "US", label: "\u{1F1FA}\u{1F1F8} " + t("filter.usa") },
    { value: "GB", label: "\u{1F1EC}\u{1F1E7} UK" },
    { value: "AU", label: "\u{1F1E6}\u{1F1FA} Australia" },
    { value: "CA", label: "\u{1F1E8}\u{1F1E6} Canada" },
    { value: "JP", label: "\u{1F1EF}\u{1F1F5} " + t("filter.japan") },
    { value: "CN", label: "\u{1F1E8}\u{1F1F3} " + t("filter.china") },
    { value: "TW", label: "\u{1F1F9}\u{1F1FC} Taiwan" },
    { value: "HK", label: "\u{1F1ED}\u{1F1F0} Hong Kong" },
    { value: "MX", label: "\u{1F1F2}\u{1F1FD} " + t("filter.mexico") },
    { value: "ES", label: "\u{1F1EA}\u{1F1F8} Spain" },
    { value: "AR", label: "\u{1F1E6}\u{1F1F7} Argentina" },
    { value: "CO", label: "\u{1F1E8}\u{1F1F4} Colombia" },
    { value: "CL", label: "\u{1F1E8}\u{1F1F1} Chile" },
    { value: "IN", label: "\u{1F1EE}\u{1F1F3} India" },
    { value: "SA", label: "\u{1F1F8}\u{1F1E6} Saudi" },
    { value: "EG", label: "\u{1F1EA}\u{1F1EC} Egypt" },
    { value: "AE", label: "\u{1F1E6}\u{1F1EA} UAE" },
  ];

  const LANGUAGE_OPTIONS: FilterOption[] = [
    { value: "", label: "\u{1F4AC} " + t("filter.allLanguages") },
    { value: "ko", label: "\u{1F1F0}\u{1F1F7} " + t("filter.korean") },
    { value: "en", label: "\u{1F1FA}\u{1F1F8} " + t("filter.english") },
    { value: "ja", label: "\u{1F1EF}\u{1F1F5} " + t("filter.japanese") },
    { value: "zh", label: "\u{1F1E8}\u{1F1F3} " + t("filter.chinese") },
    { value: "es", label: "\u{1F1EA}\u{1F1F8} " + t("filter.spanish") },
    { value: "hi", label: "\u{1F1EE}\u{1F1F3} \u0939\u093f\u0928\u094d\u0926\u0940" },
    { value: "ar", label: "\u{1F1F8}\u{1F1E6} \u0627\u0644\u0639\u0631\u0628\u064a\u0629" },
  ];

  const handleChange = (key: string, value: string) => {
    const newFilters = { country, language, category: "", postType: "", sort };
    switch (key) {
      case "sort": setSort(value); newFilters.sort = value; break;
      case "country": setCountry(value); newFilters.country = value; break;
      case "language": setLanguage(value); newFilters.language = value; break;
    }
    onFilterChange?.(newFilters);
  };

  const hasActiveFilter = country || language;
  const currentLang = UI_LANGS.find((l) => l.code === locale);

  return (
    <div className={`border-b border-border py-2.5 -mx-4 px-4 ${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Sort tabs */}
        <div className="flex items-center gap-0.5 bg-background-surface rounded-lg p-0.5 border border-border shrink-0">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleChange("sort", opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                sort === opt.value
                  ? "bg-background-overlay text-foreground"
                  : "text-foreground-subtle hover:text-foreground-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-border">|</span>

        {/* Country filter */}
        <select
          value={country}
          onChange={(e) => handleChange("country", e.target.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium appearance-none cursor-pointer transition-all shrink-0 ${
            country
              ? "bg-[#c9a84c]/15 border border-[#c9a84c]/40 text-[#c9a84c]"
              : "bg-background-surface border border-border text-foreground-muted hover:border-[#c9a84c]/30"
          }`}
        >
          {COUNTRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Language filter */}
        <select
          value={language}
          onChange={(e) => handleChange("language", e.target.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium appearance-none cursor-pointer transition-all shrink-0 ${
            language
              ? "bg-[#c9a84c]/15 border border-[#c9a84c]/40 text-[#c9a84c]"
              : "bg-background-surface border border-border text-foreground-muted hover:border-[#c9a84c]/30"
          }`}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Clear */}
        {hasActiveFilter && (
          <button
            onClick={() => { handleChange("country", ""); handleChange("language", ""); }}
            className="px-2 py-1 text-[10px] text-foreground-subtle hover:text-red-400 transition-colors shrink-0"
          >
            &times; Clear
          </button>
        )}

        {/* UI Language — prominent button style */}
        <div className="ml-auto shrink-0">
          <select
            value={locale}
            onChange={(e) => handleLocaleChange(e.target.value as Locale)}
            className="appearance-none bg-[#c9a84c]/10 border border-[#c9a84c]/30 hover:border-[#c9a84c] rounded-lg px-3 py-1.5 text-xs font-bold text-[#c9a84c] cursor-pointer focus:outline-none transition-colors"
            aria-label="Site language"
          >
            {UI_LANGS.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
