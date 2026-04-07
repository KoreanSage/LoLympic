"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";

// Demo translations — showcasing what mimzy does
const TRANSLATIONS = [
  { flag: "\uD83C\uDDFA\uD83C\uDDF8", lang: "EN", text: "When the code works on first try" },
  { flag: "\uD83C\uDDF0\uD83C\uDDF7", lang: "KO", text: "\uCF54\uB4DC\uAC00 \uD55C \uBC88\uC5D0 \uB420 \uB54C" },
  { flag: "\uD83C\uDDEF\uD83C\uDDF5", lang: "JA", text: "\u30B3\u30FC\u30C9\u304C\u4E00\u767A\u3067\u52D5\u3044\u305F\u6642" },
  { flag: "\uD83C\uDDE8\uD83C\uDDF3", lang: "ZH", text: "\u4EE3\u7801\u4E00\u6B21\u5C31\u8DD1\u901A\u7684\u65F6\u5019" },
  { flag: "\uD83C\uDDEA\uD83C\uDDF8", lang: "ES", text: "Cuando el c\u00F3digo funciona a la primera" },
  { flag: "\uD83C\uDDEE\uD83C\uDDF3", lang: "HI", text: "\u091C\u092C \u0915\u094B\u0921 \u092A\u0939\u0932\u0940 \u092C\u093E\u0930 \u092E\u0947\u0902 \u091A\u0932 \u091C\u093E\u090F" },
  { flag: "\uD83C\uDDF8\uD83C\uDDE6", lang: "AR", text: "\u0644\u0645\u0627 \u0627\u0644\u0643\u0648\u062F \u064A\u0634\u062A\u063A\u0644 \u0645\u0646 \u0623\u0648\u0644 \u0645\u0631\u0629" },
];

const FLAGS = ["\uD83C\uDDF0\uD83C\uDDF7", "\uD83C\uDDFA\uD83C\uDDF8", "\uD83C\uDDEF\uD83C\uDDF5", "\uD83C\uDDE8\uD83C\uDDF3", "\uD83C\uDDEA\uD83C\uDDF8", "\uD83C\uDDEE\uD83C\uDDF3", "\uD83C\uDDF8\uD83C\uDDE6", "\uD83C\uDDF2\uD83C\uDDFD", "\uD83C\uDDEC\uD83C\uDDE7", "\uD83C\uDDE6\uD83C\uDDFA", "\uD83C\uDDE8\uD83C\uDDE6", "\uD83C\uDDEA\uD83C\uDDEC"];

export default function HeroBanner() {
  const { data: session, status } = useSession();
  const { t } = useTranslation();
  const [activeIdx, setActiveIdx] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Cycle through translations
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % TRANSLATIONS.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Fade in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Only show for non-logged-in users
  if (status === "loading" || session) return null;

  const current = TRANSLATIONS[activeIdx];

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-[#c9a84c]/20 mb-2 transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#c9a84c]/8 via-background-surface to-[#c9a84c]/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#c9a84c]/5 rounded-full blur-[120px] animate-pulse" />

      <div className="relative z-10 px-5 py-8 md:px-8 md:py-10">
        {/* Tagline */}
        <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-black tracking-tight mb-2">
          <span className="bg-gradient-to-r from-[#c9a84c] via-[#e8d5a0] to-[#c9a84c] bg-clip-text text-transparent">
            Your Memes. 7 Languages.
          </span>
          <br className="sm:hidden" />
          <span className="text-foreground"> One Global Stage.</span>
        </h1>
        <p className="text-center text-sm md:text-base text-foreground-muted mb-6">
          {t("hero.subtitle")}
        </p>

        {/* Translation Demo Card */}
        <div className="max-w-md mx-auto mb-6">
          <div className="bg-background-elevated/80 backdrop-blur border border-border rounded-xl p-4 shadow-lg">
            {/* Original text */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{TRANSLATIONS[0].flag}</span>
              <span className="text-xs font-medium text-foreground-subtle uppercase tracking-wider">Original</span>
            </div>
            <p className="text-sm md:text-base text-foreground font-medium mb-3 pb-3 border-b border-border">
              {TRANSLATIONS[0].text}
            </p>

            {/* AI Translating shimmer */}
            <div className="flex items-center gap-2 mb-3">
              <span className="relative text-xs font-medium text-[#c9a84c]">
                AI translating...
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c9a84c]/20 to-transparent animate-[shimmer_2s_infinite] bg-[length:200%_100%]" />
              </span>
            </div>

            {/* Translated text — cycles through languages */}
            <div className="relative h-[52px] overflow-hidden">
              {TRANSLATIONS.slice(1).map((tr, i) => (
                <div
                  key={tr.lang}
                  className={`absolute inset-0 flex items-start gap-2 transition-all duration-500 ${
                    i === activeIdx - 1 || (activeIdx === 0 && i === TRANSLATIONS.length - 2)
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-3"
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{tr.flag}</span>
                  <div>
                    <span className="text-[10px] font-bold text-[#c9a84c] uppercase tracking-wider">{tr.lang}</span>
                    <p className="text-sm md:text-base text-foreground font-medium">{tr.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Language dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {TRANSLATIONS.slice(1).map((tr, i) => (
              <div
                key={tr.lang}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIdx - 1 || (activeIdx === 0 && i === TRANSLATIONS.length - 2)
                    ? "bg-[#c9a84c] scale-125"
                    : "bg-foreground-subtle/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex justify-center gap-2 md:gap-3 mb-6 flex-wrap">
          {[
            { label: t("hero.stat.languages") },
            { label: t("hero.stat.champions") },
            { label: t("hero.stat.battle") },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background-elevated/60 border border-border text-xs font-medium text-foreground-muted"
            >
              <span>{stat.label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mb-4">
          <Link
            href="/signup"
            className="relative inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#c9a84c] text-black text-sm md:text-base font-bold hover:bg-[#d4b85c] active:bg-[#b8973f] transition-all shadow-[0_0_20px_rgba(201,168,76,0.3)] hover:shadow-[0_0_30px_rgba(201,168,76,0.5)]"
          >
            {t("hero.cta")}
          </Link>
        </div>

        {/* Flag marquee */}
        <div className="overflow-hidden h-6">
          <div className="flex gap-3 animate-[marquee_20s_linear_infinite] whitespace-nowrap">
            {[...FLAGS, ...FLAGS].map((flag, i) => (
              <span key={i} className="text-base opacity-40">{flag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Shimmer + marquee keyframes (injected via style tag) */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
