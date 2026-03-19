"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { I18nContext, type Locale, type TranslationDict } from "@/i18n/provider";
import type { TranslationKeys } from "@/i18n/locales/en";
import en from "@/i18n/locales/en";

// Lazy-load non-English locales
const localeLoaders: Record<string, () => Promise<{ default: TranslationDict }>> = {
  ko: () => import("@/i18n/locales/ko"),
  ja: () => import("@/i18n/locales/ja"),
  zh: () => import("@/i18n/locales/zh"),
  es: () => import("@/i18n/locales/es"),
};

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Initialize from localStorage to prevent FOUC
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("uiLanguage") as Locale | null;
      if (stored && ["en", "ko", "ja", "zh", "es"].includes(stored)) return stored;
    }
    return "en";
  });

  const [dict, setDict] = useState<TranslationDict>(en as unknown as TranslationDict);

  // Sync with session's uiLanguage when available
  useEffect(() => {
    const sessionLang = (session?.user as any)?.uiLanguage as Locale | undefined;
    if (sessionLang && ["en", "ko", "ja", "zh", "es"].includes(sessionLang) && sessionLang !== locale) {
      setLocaleState(sessionLang);
      localStorage.setItem("uiLanguage", sessionLang);
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load dictionary when locale changes
  useEffect(() => {
    if (locale === "en") {
      setDict(en as unknown as TranslationDict);
      return;
    }
    const loader = localeLoaders[locale];
    if (loader) {
      loader()
        .then((mod) => setDict(mod.default))
        .catch(() => setDict(en as unknown as TranslationDict));
    }
  }, [locale]);

  // Update html lang attribute
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("uiLanguage", newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKeys, params?: Record<string, string | number>): string => {
      let text = dict[key] || (en as any)[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return text;
    },
    [dict]
  );

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
