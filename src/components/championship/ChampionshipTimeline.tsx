"use client";

import { useTranslation } from "@/i18n";

interface ChampionshipTimelineProps {
  phase: string;
  schedule: {
    nominationStartAt: string;
    nominationEndAt: string;
    representativeStartAt: string;
    representativeEndAt: string;
    uploadStartAt: string;
    uploadEndAt: string;
    battleStartAt: string;
    battleEndAt: string;
    resultAt: string;
  };
  remainingMs: number;
}

const PHASES = [
  { key: "NOMINATION", labelKey: "championship.phase.nomination", dates: "12/1-10", icon: "1" },
  { key: "REPRESENTATIVE", labelKey: "championship.phase.vote", dates: "12/1-15", icon: "2" },
  { key: "UPLOAD", labelKey: "championship.phase.upload", dates: "12/16-20", icon: "3" },
  { key: "CHAMPIONSHIP", labelKey: "championship.phase.battle", dates: "12/21-30", icon: "4" },
  { key: "COMPLETED", labelKey: "championship.phase.results", dates: "12/31", icon: "5" },
];

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Ended";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export default function ChampionshipTimeline({ phase, remainingMs }: ChampionshipTimelineProps) {
  const { t } = useTranslation();
  const currentIdx = PHASES.findIndex((p) => p.key === phase);

  return (
    <div className="bg-background-surface border border-border rounded-xl px-3 py-4 sm:px-6 sm:py-5">
      {/* Mobile: vertical layout */}
      <div className="flex flex-col gap-0 sm:hidden">
        {PHASES.map((p, i) => {
          const isActive = p.key === phase;
          const isPast = i < currentIdx;

          return (
            <div key={p.key}>
              <div className="flex items-center gap-3">
                {/* Circle */}
                <div
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs border-2 flex-shrink-0 transition-all ${
                    isActive
                      ? "bg-[#c9a84c] border-[#c9a84c] text-black shadow-lg shadow-[#c9a84c]/30"
                      : isPast
                        ? "bg-[#c9a84c]/20 border-[#c9a84c]/50 text-[#c9a84c]"
                        : "bg-background-elevated border-border text-foreground-subtle"
                  }`}
                >
                  {isPast ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span>{p.icon}</span>
                  )}
                  {isActive && (
                    <span className="absolute inset-0 rounded-full border-2 border-[#c9a84c] animate-ping opacity-30" />
                  )}
                </div>

                {/* Label + date */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${
                    isActive ? "text-[#c9a84c]" : isPast ? "text-foreground-muted" : "text-foreground-subtle"
                  }`}>
                    {t(p.labelKey as never)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${isActive ? "text-[#c9a84c]/70" : "text-foreground-subtle"}`}>
                      {p.dates}
                    </span>
                    {isActive && remainingMs > 0 && (
                      <span className="text-[10px] text-[#c9a84c] font-mono font-bold">
                        {formatRemaining(remainingMs)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Vertical connector */}
              {i < PHASES.length - 1 && (
                <div className="ml-[15px] my-0.5">
                  <div className={`w-0.5 h-4 transition-colors ${
                    isPast ? "bg-[#c9a84c]/50" : isActive ? "bg-gradient-to-b from-[#c9a84c]/50 to-border" : "bg-border"
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet: horizontal layout */}
      <div className="hidden sm:flex items-start justify-between gap-0">
        {PHASES.map((p, i) => {
          const isActive = p.key === phase;
          const isPast = i < currentIdx;

          return (
            <div key={p.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0 min-w-0">
                <div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                    isActive
                      ? "bg-[#c9a84c] border-[#c9a84c] text-black shadow-lg shadow-[#c9a84c]/30"
                      : isPast
                        ? "bg-[#c9a84c]/20 border-[#c9a84c]/50 text-[#c9a84c]"
                        : "bg-background-elevated border-border text-foreground-subtle"
                  }`}
                >
                  {isPast ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <span>{p.icon}</span>
                  )}
                  {isActive && (
                    <span className="absolute inset-0 rounded-full border-2 border-[#c9a84c] animate-ping opacity-30" />
                  )}
                </div>

                <p className={`mt-1.5 text-[11px] font-medium text-center leading-tight ${
                  isActive ? "text-[#c9a84c]" : isPast ? "text-foreground-muted" : "text-foreground-subtle"
                }`}>
                  {t(p.labelKey as never)}
                </p>
                <p className={`text-[10px] ${isActive ? "text-[#c9a84c]/70" : "text-foreground-subtle"}`}>
                  {p.dates}
                </p>
                {isActive && remainingMs > 0 && (
                  <p className="text-[10px] text-[#c9a84c] font-mono mt-0.5 font-bold">
                    {formatRemaining(remainingMs)}
                  </p>
                )}
              </div>

              {i < PHASES.length - 1 && (
                <div className="flex-1 mx-2 mt-[20px]">
                  <div className={`h-0.5 w-full transition-colors ${
                    isPast ? "bg-[#c9a84c]/50" : isActive ? "bg-gradient-to-r from-[#c9a84c]/50 to-border" : "bg-border"
                  }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
