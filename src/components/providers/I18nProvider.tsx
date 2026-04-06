"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { I18nContext, type Locale, type TranslationDict } from "@/i18n/provider";
import type { TranslationKeys } from "@/i18n/locales/en";
import en from "@/i18n/locales/en";
import LanguageSelectModal from "@/components/ui/LanguageSelectModal";

// Lazy-load non-English locales
const localeLoaders: Record<string, () => Promise<{ default: TranslationDict }>> = {
  ko: () => import("@/i18n/locales/ko"),
  ja: () => import("@/i18n/locales/ja"),
  zh: () => import("@/i18n/locales/zh"),
  es: () => import("@/i18n/locales/es"),
  hi: () => import("@/i18n/locales/hi"),
  ar: () => import("@/i18n/locales/ar"),
};

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Check if user has ever selected a language
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Initialize from localStorage to prevent FOUC
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("uiLanguage") as Locale | null;
      if (stored && ["en", "ko", "ja", "zh", "es", "hi", "ar"].includes(stored)) return stored;
    }
    return "en";
  });

  const [dict, setDict] = useState<TranslationDict>(en as unknown as TranslationDict);

  // Show language selection modal for first-time visitors (not logged in, no stored preference)
  useEffect(() => {
    const hasChosen = localStorage.getItem("uiLanguage");
    const hasSession = !!session?.user;
    if (!hasChosen && !hasSession) {
      setShowLanguageModal(true);
    }
  }, [session]);

  // Sync with session's uiLanguage ONLY on initial login (not on every session refresh)
  // This prevents overwriting the user's language choice during the same session.
  const [hasInitializedFromSession, setHasInitializedFromSession] = useState(false);
  useEffect(() => {
    if (hasInitializedFromSession) return;
    const sessionLang = session?.user?.uiLanguage as Locale | undefined;
    const storedLang = localStorage.getItem("uiLanguage");
    // Only sync from session if user hasn't manually set a language yet
    if (sessionLang && !storedLang && ["en", "ko", "ja", "zh", "es", "hi", "ar"].includes(sessionLang)) {
      setLocaleState(sessionLang);
      localStorage.setItem("uiLanguage", sessionLang);
    }
    if (session?.user) {
      setHasInitializedFromSession(true);
    }
  }, [session, hasInitializedFromSession]);

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

  // Update html lang and dir attributes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("uiLanguage", newLocale);
    localStorage.setItem("preferredLanguage", newLocale);
    localStorage.setItem("mimzy_preferredLanguage", newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKeys, params?: Record<string, string | number>): string => {
      const raw = dict[key] || (en as Record<string, string>)[key] || key;
      // Defensive: ensure we always return a string, never an object/Date/etc.
      let text = typeof raw === "string" ? raw : String(raw);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return text;
    },
    [dict]
  );

  const handleLanguageSelect = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    window.dispatchEvent(new StorageEvent("storage", { key: "mimzy_preferredLanguage", newValue: newLocale }));
    setShowLanguageModal(false);
  }, [setLocale]);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return (
    <I18nContext.Provider value={value}>
      {showLanguageModal && <LanguageSelectModal onSelect={handleLanguageSelect} />}
      {children}
    </I18nContext.Provider>
  );
}
