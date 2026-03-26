"use client";

import { useTranslation } from "@/i18n";

interface CountryChampionBadgeProps {
  countryFlag?: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Badge shown next to usernames when their country is currently ranked #1.
 * Displays a crown/trophy emoji with country flag.
 */
export default function CountryChampionBadge({
  countryFlag,
  size = "sm",
  className = "",
}: CountryChampionBadgeProps) {
  const { t } = useTranslation();

  const sizeClasses = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-[#c9a84c]/15 border border-[#c9a84c]/25 ${sizeClasses} ${className}`}
      title={t("countryChampion.badge")}
      role="img"
      aria-label={t("countryChampion.badge")}
    >
      <span>👑</span>
      {countryFlag && <span>{countryFlag}</span>}
    </span>
  );
}
