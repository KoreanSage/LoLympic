"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/provider";

const LANGUAGES: { code: Locale; flag: string; name: string; nativeName: string }[] = [
  { code: "en", flag: "🇺🇸", name: "English", nativeName: "English" },
  { code: "ko", flag: "🇰🇷", name: "Korean", nativeName: "한국어" },
  { code: "ja", flag: "🇯🇵", name: "Japanese", nativeName: "日本語" },
  { code: "zh", flag: "🇨🇳", name: "Chinese", nativeName: "中文" },
  { code: "es", flag: "🇪🇸", name: "Spanish", nativeName: "Español" },
  { code: "hi", flag: "🇮🇳", name: "Hinglish", nativeName: "Hinglish" },
  { code: "ar", flag: "🇸🇦", name: "Arabic", nativeName: "العربية" },
];

interface LanguageSelectModalProps {
  onSelect: (locale: Locale) => void;
}

export default function LanguageSelectModal({ onSelect }: LanguageSelectModalProps) {
  const [selected, setSelected] = useState<Locale | null>(null);

  const handleConfirm = () => {
    if (selected) {
      onSelect(selected);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[90%] max-w-sm bg-background-surface border border-border rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Logo / Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#c9a84c] mb-1">mimzy</h1>
          <p className="text-sm text-foreground-subtle">
            Choose your language
          </p>
          <p className="text-xs text-foreground-muted mt-0.5">
            언어를 선택하세요 / 言語を選択
          </p>
        </div>

        {/* Language Grid */}
        <div className="grid grid-cols-1 gap-2 mb-6">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelected(lang.code)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                selected === lang.code
                  ? "border-[#c9a84c] bg-[#c9a84c]/10 shadow-[0_0_12px_rgba(201,168,76,0.2)]"
                  : "border-border hover:border-foreground/20 bg-background-elevated/50"
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${
                  selected === lang.code ? "text-[#c9a84c]" : "text-foreground"
                }`}>
                  {lang.nativeName}
                </span>
                <span className="text-xs text-foreground-muted ml-2">
                  {lang.name}
                </span>
              </div>
              {selected === lang.code && (
                <svg className="w-5 h-5 text-[#c9a84c] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          disabled={!selected}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
            selected
              ? "bg-[#c9a84c] hover:bg-[#d4b65c] text-black shadow-[0_0_20px_rgba(201,168,76,0.3)]"
              : "bg-foreground/10 text-foreground-muted cursor-not-allowed"
          }`}
        >
          {selected
            ? LANGUAGES.find((l) => l.code === selected)?.code === "ko"
              ? "시작하기"
              : LANGUAGES.find((l) => l.code === selected)?.code === "ja"
                ? "始める"
                : LANGUAGES.find((l) => l.code === selected)?.code === "zh"
                  ? "开始"
                  : LANGUAGES.find((l) => l.code === selected)?.code === "es"
                    ? "Empezar"
                    : LANGUAGES.find((l) => l.code === selected)?.code === "hi"
                      ? "Shuru karo"
                      : LANGUAGES.find((l) => l.code === selected)?.code === "ar"
                        ? "ابدأ"
                        : "Get Started"
            : "Select a language"}
        </button>
      </div>
    </div>
  );
}
