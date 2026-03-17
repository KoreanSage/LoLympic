import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { LanguageCode, LANGUAGE_CONFIG_MAP } from "@/types";
import { COUNTRY_MAP } from "@/lib/constants";

/**
 * Merge Tailwind CSS classes with conflict resolution.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a date as a human-readable relative time string.
 * e.g. "just now", "3m ago", "2h ago", "5d ago", "Jan 15"
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - target.getTime();

  // Future dates
  if (diffMs < 0) {
    return "just now";
  }

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

/**
 * Get the flag emoji for a country by its ISO alpha-2 code.
 * Returns an empty string if the country is not found.
 */
export function getCountryFlag(countryId: string): string {
  return COUNTRY_MAP.get(countryId)?.flagEmoji ?? "";
}

/**
 * Get the English display name for a language code.
 */
export function getLanguageName(code: LanguageCode): string {
  return LANGUAGE_CONFIG_MAP[code]?.nameEn ?? code;
}

/**
 * Get the native display name for a language code.
 */
export function getLanguageNativeName(code: LanguageCode): string {
  return LANGUAGE_CONFIG_MAP[code]?.nameNative ?? code;
}

/**
 * Truncate a string to a max length, appending ellipsis if needed.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "\u2026";
}

/**
 * Format a number with compact notation (e.g. 1.2K, 3.4M).
 */
export function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1_000_000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (num < 1_000_000_000)
    return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
}

/**
 * Sleep for the given number of milliseconds. Useful in async flows.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
