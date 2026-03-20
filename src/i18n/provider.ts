"use client";

export type { TranslationKeys } from "./locales/en";

import { createContext, useContext } from "react";
import type { TranslationKeys } from "./locales/en";

// ── Types ────────────────────────────────────────────────────────────────────

export type Locale = "en" | "ko" | "ja" | "zh" | "es" | "hi" | "ar";

export type TranslationDict = Record<TranslationKeys, string>;

export interface I18nContextType {
  locale: Locale;
  t: (key: TranslationKeys, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

export const I18nContext = createContext<I18nContextType>({
  locale: "en",
  t: (key) => key,
  setLocale: () => {},
});

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTranslation() {
  return useContext(I18nContext);
}
