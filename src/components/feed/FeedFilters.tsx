"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
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
    postType?: string;
    sort: string;
  }) => void;
  className?: string;
}

export default function FeedFilters({
  onFilterChange,
  className = "",
}: FeedFiltersProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [sort, setSort] = useState("trending");
  const [postType, setPostType] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");
  const [showRightFade, setShowRightFade] = useState(false);
  const [userCountryId, setUserCountryId] = useState<string | null>(null);
  const [userCountryFlag, setUserCountryFlag] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user's country
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/users/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.countryId) {
          setUserCountryId(data.countryId);
          setUserCountryFlag(data.country?.flagEmoji || null);
        }
      })
      .catch(() => {});
  }, [session?.user]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const checkOverflow = () => {
      setShowRightFade(el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    checkOverflow();
    el.addEventListener("scroll", checkOverflow, { passive: true });
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkOverflow);
      ro.disconnect();
    };
  }, []);

  const SORT_OPTIONS: FilterOption[] = [
    { value: "trending", label: t("filter.trending") },
    { value: "recent", label: t("filter.recent") },
    { value: "top", label: t("filter.top") },
  ];

  const POST_TYPE_OPTIONS: FilterOption[] = [
    { value: "", label: t("filter.allCategories") },
    { value: "meme", label: "😂 Memes" },
    { value: "community", label: "💬 Community" },
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
    const newFilters: { country: string; language: string; category: string; postType: string; sort: string } = { country, language, category, postType, sort };
    switch (key) {
      case "sort":
        setSort(value);
        newFilters.sort = value;
        break;
      case "postType":
        setPostType(value);
        newFilters.postType = value;
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

  const hasActiveFilter = country || language || category;

  return (
    <div
      className={`border-b border-border py-2.5 -mx-4 px-4 ${className}`}
    >
      <div className="relative">
        <div ref={scrollRef} className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
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

          <span className="text-border shrink-0">|</span>

          {/* Post type pills */}
          {POST_TYPE_OPTIONS.filter((o) => o.value !== "").map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleChange("postType", postType === opt.value ? "" : opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0 ${
                postType === opt.value
                  ? "bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30"
                  : "text-foreground-subtle hover:text-foreground-muted border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}

          <span className="text-border shrink-0">|</span>

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

          {/* My Country quick filter */}
          {userCountryId && (
            <button
              onClick={() => handleChange("country", country === userCountryId ? "" : userCountryId)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all whitespace-nowrap shrink-0 ${
                country === userCountryId
                  ? "border-[#c9a84c] bg-[#c9a84c]/15 text-[#c9a84c]"
                  : "border-[#c9a84c]/30 text-[#c9a84c]/70 hover:border-[#c9a84c] hover:text-[#c9a84c]"
              }`}
            >
              {userCountryFlag || "\uD83C\uDFF3\uFE0F"} {t("filter.myCountry")}
            </button>
          )}

          {/* Clear filters */}
          {hasActiveFilter && (
            <button
              onClick={() => {
                handleChange("country", "");
                handleChange("language", "");
                handleChange("category", "");
              }}
              className="px-2 py-1 text-[10px] text-foreground-subtle hover:text-foreground-muted transition-colors shrink-0"
            >
              Clear
            </button>
          )}
        </div>
        {showRightFade && (
          <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-background to-transparent" />
        )}
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
