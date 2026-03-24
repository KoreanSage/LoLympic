"use client";

import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  countryFlag?: string;
  isChampion?: boolean;
  className?: string;
}

const sizeMap = {
  xs: "w-5 h-5",
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-14 h-14",
};

const pixelSizeMap = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 56,
};

const flagSizeMap = {
  xs: "w-2.5 h-2.5 text-[6px]",
  sm: "w-3 h-3 text-[8px]",
  md: "w-4 h-4 text-[10px]",
  lg: "w-5 h-5 text-xs",
  xl: "w-6 h-6 text-sm",
};

const ringSizeMap = {
  xs: "ring-[1.5px]",
  sm: "ring-[1.5px]",
  md: "ring-2",
  lg: "ring-2",
  xl: "ring-[3px]",
};

export default function Avatar({
  src,
  alt = "User",
  size = "md",
  countryFlag,
  isChampion = false,
  className = "",
}: AvatarProps) {
  const championRing = isChampion
    ? `${ringSizeMap[size]} ring-[#c9a84c] ring-offset-1 ring-offset-background`
    : "";

  return (
    <div className={`relative inline-flex shrink-0 ${className}`} role="img" aria-label={alt}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={pixelSizeMap[size]}
          height={pixelSizeMap[size]}
          className={`${sizeMap[size]} rounded-full object-cover bg-background-overlay ${championRing}`}
          unoptimized
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full bg-background-overlay flex items-center justify-center text-foreground-subtle ${championRing}`}
        >
          <span className="font-medium">
            {alt.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {countryFlag && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${flagSizeMap[size]} flex items-center justify-center rounded-full bg-background-surface border border-border leading-none`}
        >
          {countryFlag}
        </span>
      )}
      {isChampion && !countryFlag && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${flagSizeMap[size]} flex items-center justify-center leading-none`}
        >
          🏆
        </span>
      )}
    </div>
  );
}
