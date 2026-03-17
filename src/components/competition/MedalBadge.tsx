"use client";

type MedalType = "GOLD" | "SILVER" | "BRONZE";

interface MedalBadgeProps {
  type: MedalType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const MEDAL_CONFIG: Record<
  MedalType,
  { color: string; bg: string; label: string; emoji: string }
> = {
  GOLD: {
    color: "#FFD700",
    bg: "rgba(255, 215, 0, 0.1)",
    label: "Gold",
    emoji: "\u{1F947}",
  },
  SILVER: {
    color: "#C0C0C0",
    bg: "rgba(192, 192, 192, 0.1)",
    label: "Silver",
    emoji: "\u{1F948}",
  },
  BRONZE: {
    color: "#CD7F32",
    bg: "rgba(205, 127, 50, 0.1)",
    label: "Bronze",
    emoji: "\u{1F949}",
  },
};

const sizeClasses = {
  sm: "w-5 h-5 text-xs",
  md: "w-7 h-7 text-sm",
  lg: "w-10 h-10 text-lg",
};

export default function MedalBadge({
  type,
  size = "md",
  showLabel = false,
  className = "",
}: MedalBadgeProps) {
  const config = MEDAL_CONFIG[type];

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${className}`}
        style={{
          backgroundColor: config.bg,
          color: config.color,
          borderColor: `${config.color}33`,
          borderWidth: 1,
        }}
      >
        <span>{config.emoji}</span>
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: config.bg }}
      title={config.label}
    >
      {config.emoji}
    </span>
  );
}
