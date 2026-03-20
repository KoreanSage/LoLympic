"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n";

interface FilterOption {
  value: string;
  label: string;
}

interface FeedFiltersProps {
  onFilterChange?: (filters: {
    country?: string;
    language?: string;
    category?: string;
    sort: string;
  }) => void;
  className?: string;
}

export default function FeedFilters({
  onFilterChange,
  className = "",
}: FeedFiltersProps) {
  const { t } = useTranslation();
  const [sort, setSort] = useState("trending");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");

  const SORT_OPTIONS: FilterOption[] = [
    { value: "trending", label: t("filter.trending") },
    { value: "recent", label: t("filter.recent") },
    { value: "top", label: t("filter.top") },
  ];

  const COUNTRY_OPTIONS: FilterOption[] = [
    { value: "", label: t("filter.allCountries") },
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
    { value: "", label: t("filter.allLanguages") },
    { value: "ko", label: "한 " + t("filter.korean") },
    { value: "en", label: "A " + t("filter.english") },
    { value: "ja", label: "あ " + t("filter.japanese") },
    { value: "zh", label: "字 " + t("filter.chinese") },
    { value: "es", label: "Ñ " + t("filter.spanish") },
    { value: "hi", label: "अ हिन्दी" },
    { value: "ar", label: "ع العربية" },
  ];

  const CATEGORY_OPTIONS: FilterOption[] = [
    { value: "", label: t("filter.allCategories") },
    { value: "daily", label: "☕ Daily" },
    { value: "sports", label: "⚽ Sports" },
    { value: "politics", label: "🏛️ Politics" },
    { value: "anime", label: "🎌 Anime" },
    { value: "gaming", label: "🎮 Gaming" },
    { value: "entertainment", label: "🎬 Entertainment" },
  ];

  const handleChange = (key: string, value: string) => {
    const newFilters = { country, language, category, sort };
    switch (key) {
      case "sort":
        setSort(value);
        newFilters.sort = value;
        break;
      case "country":
        setCountry(value);
        newFilters.country = value;
        break;
      case "language":
        setLanguage(value);
        newFilters.language = value;
        break;
      case "category":
        setCategory(value);
        newFilters.category = value;
        break;
    }
    onFilterChange?.(newFilters);
  };

  return (
    <div
      className={`border-b border-border py-3 -mx-4 px-4 ${className}`}
    >
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
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

        <span className="text-foreground-subtle">|</span>

        {/* Dropdown filters */}
        <FilterSelect
          value={country}
          options={COUNTRY_OPTIONS}
          onChange={(v) => handleChange("country", v)}
        />
        <FilterSelect
          value={language}
          options={LANGUAGE_OPTIONS}
          onChange={(v) => handleChange("language", v)}
        />
        <FilterSelect
          value={category}
          options={CATEGORY_OPTIONS}
          onChange={(v) => handleChange("category", v)}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-background-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground-muted appearance-none cursor-pointer hover:border-border-active focus:outline-none focus:border-[#c9a84c]/50 transition-colors shrink-0"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
