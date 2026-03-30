import { LanguageCode } from "@/types";
import { LanguageCode as PrismaLanguageCode } from "@prisma/client";

// ============================================================================
// Countries
// ============================================================================

export interface CountryInfo {
  id: string;
  nameEn: string;
  nameLocal: string;
  flagEmoji: string;
}

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { id: "KR", nameEn: "South Korea", nameLocal: "\ub300\ud55c\ubbfc\uad6d", flagEmoji: "\ud83c\uddf0\ud83c\uddf7" },
  { id: "US", nameEn: "United States", nameLocal: "United States", flagEmoji: "\ud83c\uddfa\ud83c\uddf8" },
  { id: "JP", nameEn: "Japan", nameLocal: "\u65e5\u672c", flagEmoji: "\ud83c\uddef\ud83c\uddf5" },
  { id: "CN", nameEn: "China", nameLocal: "\u4e2d\u56fd", flagEmoji: "\ud83c\udde8\ud83c\uddf3" },
  { id: "MX", nameEn: "Mexico", nameLocal: "M\u00e9xico", flagEmoji: "\ud83c\uddf2\ud83c\uddfd" },
  { id: "ES", nameEn: "Spain", nameLocal: "Espa\u00f1a", flagEmoji: "\ud83c\uddea\ud83c\uddf8" },
  { id: "GB", nameEn: "United Kingdom", nameLocal: "United Kingdom", flagEmoji: "\ud83c\uddec\ud83c\udde7" },
  { id: "BR", nameEn: "Brazil", nameLocal: "Brasil", flagEmoji: "\ud83c\udde7\ud83c\uddf7" },
  { id: "DE", nameEn: "Germany", nameLocal: "Deutschland", flagEmoji: "\ud83c\udde9\ud83c\uddea" },
  { id: "FR", nameEn: "France", nameLocal: "France", flagEmoji: "\ud83c\uddeb\ud83c\uddf7" },
] as const;

export const COUNTRY_MAP = new Map(
  SUPPORTED_COUNTRIES.map((c) => [c.id, c])
);

// ============================================================================
// Languages
// ============================================================================

export const VALID_LANGUAGES = ["ko", "en", "ja", "zh", "es", "hi", "ar"] as const;
export type LanguageCodeString = typeof VALID_LANGUAGES[number];

export const VALID_LANGUAGE_CODES: PrismaLanguageCode[] = [
  "ko", "en", "ja", "zh", "es", "hi", "ar",
];

export const VALID_LANGUAGE_SET = new Set<string>(VALID_LANGUAGE_CODES);

export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  LanguageCode.ko,
  LanguageCode.en,
  LanguageCode.ja,
  LanguageCode.zh,
  LanguageCode.es,
  LanguageCode.hi,
  LanguageCode.ar,
];

/** Font families optimized per language for meme text rendering */
export const LANGUAGE_FONT_MAP: Record<LanguageCode, string> = {
  [LanguageCode.ko]: "Noto Sans KR",
  [LanguageCode.ja]: "Noto Sans JP",
  [LanguageCode.zh]: "Noto Sans SC",
  [LanguageCode.en]: "Impact",
  [LanguageCode.es]: "Arial",
  [LanguageCode.hi]: "Noto Sans Devanagari",
  [LanguageCode.ar]: "Noto Sans Arabic",
};

// ============================================================================
// Season
// ============================================================================

export const SEASON_DURATION_DAYS = 7;

// ============================================================================
// Image Upload
// ============================================================================

/** Maximum image size in bytes (10 MB) */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

// ============================================================================
// Rendering Defaults
// ============================================================================

export const RENDERING_DEFAULTS = {
  /** Default stroke for text readability on images */
  stroke: {
    color: "#000000",
    width: 2,
  },
  /** Default text shadow for depth */
  shadow: {
    color: "rgba(0, 0, 0, 0.8)",
    offsetX: 1,
    offsetY: 1,
    blur: 3,
  },
  /** Default font size in pixels */
  fontSize: 32,
  /** Default line height ratio */
  lineHeight: 1.2,
  /** Default text color */
  textColor: "#FFFFFF",
  /** Default background overlay opacity for readability */
  backgroundOverlayOpacity: 0.6,
} as const;

// ============================================================================
// Reactions
// ============================================================================

export const REACTION_EMOJI_MAP = {
  FIRE: "\ud83d\udd25",
  LAUGH: "\ud83d\ude02",
  SKULL: "\ud83d\udc80",
  HEART: "\u2764\ufe0f",
  CRY: "\ud83d\ude22",
} as const;

// ============================================================================
// Pagination
// ============================================================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============================================================================
// App Metadata
// ============================================================================

export const APP_NAME = "mimzy";
export const APP_DESCRIPTION =
  "AI-powered global meme translation and Olympic-style country competition";
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
