"use client";

import { useState } from "react";

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

const SORT_OPTIONS: FilterOption[] = [
  { value: "trending", label: "Trending" },
  { value: "recent", label: "Recent" },
  { value: "top", label: "Top" },
];

const COUNTRY_OPTIONS: FilterOption[] = [
  { value: "", label: "All Countries" },
  { value: "US", label: "\u{1F1FA}\u{1F1F8} USA" },
  { value: "KR", label: "\u{1F1F0}\u{1F1F7} Korea" },
  { value: "JP", label: "\u{1F1EF}\u{1F1F5} Japan" },
  { value: "CN", label: "\u{1F1E8}\u{1F1F3} China" },
  { value: "MX", label: "\u{1F1F2}\u{1F1FD} Mexico" },
];

const LANGUAGE_OPTIONS: FilterOption[] = [
  { value: "", label: "All Languages" },
  { value: "en", label: "English" },
  { value: "ko", label: "\uD55C\uAD6D\uC5B4" },
  { value: "ja", label: "\u65E5\u672C\u8A9E" },
  { value: "zh", label: "\u4E2D\u6587" },
  { value: "es", label: "Espa\u00F1ol" },
];

const CATEGORY_OPTIONS: FilterOption[] = [
  { value: "", label: "All Categories" },
  { value: "daily", label: "☕ Daily" },
  { value: "sports", label: "⚽ Sports" },
  { value: "politics", label: "🏛️ Politics" },
  { value: "anime", label: "🎌 Anime" },
  { value: "gaming", label: "🎮 Gaming" },
  { value: "entertainment", label: "🎬 Entertainment" },
];

export default function FeedFilters({
  onFilterChange,
  className = "",
}: FeedFiltersProps) {
  const [sort, setSort] = useState("trending");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");

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
