"use client";

interface SeasonBarProps {
  seasonNumber?: number;
  timeLeft?: string;
  leadingCountry?: string;
  leadingFlag?: string;
  progress?: number;
  className?: string;
}

export default function SeasonBar({
  seasonNumber = 12,
  timeLeft = "2d 14h",
  leadingCountry = "USA",
  leadingFlag = "\u{1F1FA}\u{1F1F8}",
  progress = 72,
  className = "",
}: SeasonBarProps) {
  return (
    <div
      className={`bg-background-surface border-b border-border px-4 py-1.5 ${className}`}
    >
      <div className="max-w-[1280px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#c9a84c] font-semibold">
            Season {seasonNumber}
          </span>
          <span className="text-foreground-subtle">&middot;</span>
          <span className="text-foreground-muted">{timeLeft} left</span>
          <span className="text-foreground-subtle">&middot;</span>
          <span className="text-foreground-muted">
            Leading: {leadingFlag} {leadingCountry}
          </span>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-24 h-1 bg-background-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c9a84c] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-foreground-subtle">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
