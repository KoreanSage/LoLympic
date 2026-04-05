"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";

interface WinnerData {
  type: "monthly" | "yearly";
  // Monthly
  month?: number;
  year?: number;
  post?: {
    id: string;
    title: string;
    translatedTitle?: string | null;
    translatedImageUrl?: string | null;
    sourceLanguage?: string | null;
    imageUrl: string;
  };
  author?: {
    username: string;
    displayName: string | null;
  };
  country?: {
    flagEmoji: string;
    nameEn: string;
  } | null;
  fireCount?: number;
  // Yearly extras
  championCountry?: {
    flagEmoji: string;
    nameEn: string;
    totalReactions: number;
  } | null;
  seasonName?: string;
}

function getMonthName(month: number, locale: string): string {
  const localeMap: Record<string, string> = {
    en: "en-US", ko: "ko-KR", ja: "ja-JP", zh: "zh-CN",
    es: "es-ES", hi: "hi-IN", ar: "ar-SA",
  };
  return new Date(2000, month - 1).toLocaleDateString(localeMap[locale] || locale, { month: 'long' });
}

export default function WinnerPopup() {
  const { t, locale } = useTranslation();
  const [winner, setWinner] = useState<WinnerData | null>(null);
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    checkForWinner();
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkForWinner() {
    try {
      const res = await fetch(`/api/winner-popup?lang=${locale}`);
      if (!res.ok) return;
      const data = await res.json();

      if (!data.winner) return;

      // Check if already seen
      const seenKey = data.winner.type === "yearly"
        ? `winner-seen-yearly-${data.winner.year}`
        : `winner-seen-${data.winner.year}-${data.winner.month}`;

      if (localStorage.getItem(seenKey)) return;

      setWinner(data.winner);
      setVisible(true);

      // Animate in after a small delay
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
    } catch {
      // ignore
    }
  }

  function handleDismiss() {
    setAnimateIn(false);
    setTimeout(() => {
      setVisible(false);
      setWinner(null);

      // Mark as seen
      if (winner) {
        const seenKey = winner.type === "yearly"
          ? `winner-seen-yearly-${winner.year}`
          : `winner-seen-${winner.year}-${winner.month}`;
        localStorage.setItem(seenKey, "1");
      }
    }, 300);
  }

  if (!visible || !winner) return null;

  const isYearly = winner.type === "yearly";

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 ${
        animateIn ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      }`}
      onClick={handleDismiss}
    >
      <div
        className={`relative mx-4 max-w-sm w-full transition-all duration-500 ${
          animateIn ? "scale-100 opacity-100 translate-y-0" : "scale-90 opacity-0 translate-y-8"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect for yearly */}
        {isYearly && (
          <div className="absolute -inset-1 bg-gradient-to-r from-[#c9a84c] via-[#FFD700] to-[#c9a84c] rounded-2xl blur-md opacity-30 animate-pulse" />
        )}

        <div className={`relative rounded-2xl overflow-hidden border ${
          isYearly
            ? "bg-gradient-to-b from-[#1a1500] to-background-surface border-[#c9a84c]/50"
            : "bg-background-surface border-[#c9a84c]/30"
        }`}>
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center pt-6 pb-3 px-6">
            <div className={`text-4xl mb-2 ${isYearly ? "animate-bounce" : ""}`}>
              {isYearly ? "👑" : "🏆"}
            </div>
            <h2 className={`text-lg font-bold ${isYearly ? "text-[#FFD700]" : "text-[#c9a84c]"}`}>
              {isYearly
                ? `${winner.seasonName || winner.year} ${t("winner.champion")}`
                : `${getMonthName(winner.month || 1, locale)} ${t("winner.monthlyWinner")}`
              }
            </h2>
            {isYearly && (
              <p className="text-xs text-[#c9a84c]/70 mt-1">{t("winner.memeOfTheYear")}</p>
            )}
          </div>

          {/* Meme image */}
          {winner.post && (
            <div className="px-6 pb-3">
              <Link href={`/post/${winner.post.id}`} onClick={handleDismiss}>
                <div className={`rounded-xl overflow-hidden border-2 ${
                  isYearly ? "border-[#c9a84c]" : "border-border"
                }`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(winner.post.sourceLanguage !== locale && winner.post.translatedImageUrl) || winner.post.imageUrl}
                    alt={(winner.post.sourceLanguage !== locale && winner.post.translatedTitle) || winner.post.title}
                    className="w-full aspect-[4/3] object-cover"
                  />
                </div>
              </Link>
            </div>
          )}

          {/* Info */}
          <div className="px-6 pb-4 text-center">
            {winner.post && (
              <p className="text-sm font-medium text-foreground mb-1 line-clamp-2">
                {(winner.post.sourceLanguage !== locale && winner.post.translatedTitle) || winner.post.title}
              </p>
            )}
            <p className="text-xs text-foreground-muted">
              {winner.country?.flagEmoji}{" "}
              {winner.author?.displayName || winner.author?.username}
              {winner.fireCount && (
                <span className="text-[#c9a84c] ml-2">
                  🔥 {winner.fireCount.toLocaleString()}
                </span>
              )}
            </p>
          </div>

          {/* Yearly: Country champion */}
          {isYearly && winner.championCountry && (
            <div className="mx-6 mb-4 p-3 bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl text-center">
              <p className="text-[10px] text-[#c9a84c]/70 uppercase tracking-wider mb-1">
                {t("winner.countryOfTheYear")}
              </p>
              <p className="text-sm font-bold text-foreground">
                {winner.championCountry.flagEmoji} {winner.championCountry.nameEn}
              </p>
              <p className="text-xs text-foreground-subtle">
                🔥 {winner.championCountry.totalReactions.toLocaleString()}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 px-6 pb-6">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground-muted hover:bg-background-elevated transition-colors"
            >
              {t("battle.stop")}
            </button>
            {winner.post && (
              <Link
                href={isYearly ? "/leaderboard" : `/post/${winner.post.id}`}
                onClick={handleDismiss}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-center transition-colors ${
                  isYearly
                    ? "bg-gradient-to-r from-[#c9a84c] to-[#FFD700] text-black hover:from-[#d4b65e] hover:to-[#FFE44D]"
                    : "bg-[#c9a84c] text-black hover:bg-[#d4b65e]"
                }`}
              >
                {isYearly ? t("winner.viewResults") : t("winner.viewPost")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
