"use client";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  countryFlag?: string;
  className?: string;
}

const sizeMap = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-14 h-14",
};

const flagSizeMap = {
  sm: "w-3 h-3 text-[8px]",
  md: "w-4 h-4 text-[10px]",
  lg: "w-5 h-5 text-xs",
  xl: "w-6 h-6 text-sm",
};

export default function Avatar({
  src,
  alt = "User",
  size = "md",
  countryFlag,
  className = "",
}: AvatarProps) {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`${sizeMap[size]} rounded-full object-cover bg-background-overlay`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full bg-background-overlay flex items-center justify-center text-foreground-subtle`}
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
    </div>
  );
}
