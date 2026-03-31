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
  { key: "NOMINATION", labelKey: "championship.phase.nomination", dates: "12/1-10" },
  { key: "REPRESENTATIVE", labelKey: "championship.phase.vote", dates: "12/1-15" },
  { key: "UPLOAD", labelKey: "championship.phase.upload", dates: "12/16-20" },
  { key: "CHAMPIONSHIP", labelKey: "championship.phase.battle", dates: "12/21-30" },
  { key: "COMPLETED", labelKey: "championship.phase.results", dates: "12/31" },
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
    <div className="w-full overflow-x-auto">
      <div className="flex items-center gap-0 min-w-[600px] px-4 py-3">
        {PHASES.map((p, i) => {
          const isActive = p.key === phase;
          const isPast = i < currentIdx;
          const isFuture = i > currentIdx;

          return (
            <div key={p.key} className="flex items-center flex-1">
              {/* Phase node */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                    isActive
                      ? "bg-[#c9a84c] border-[#c9a84c] text-black scale-110 shadow-lg shadow-[#c9a84c]/30"
                      : isPast
                        ? "bg-[#c9a84c]/20 border-[#c9a84c]/40 text-[#c9a84c]"
                        : "bg-background-elevated border-border text-foreground-subtle"
                  }`}
                >
                  {isPast ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <p className={`mt-1.5 text-[11px] font-medium text-center ${
                  isActive ? "text-[#c9a84c]" : isPast ? "text-foreground-muted" : "text-foreground-subtle"
                }`}>
                  {t(p.labelKey as never)}
                </p>
                <p className={`text-[10px] ${isActive ? "text-[#c9a84c]/70" : "text-foreground-subtle"}`}>
                  {p.dates}
                </p>
                {isActive && remainingMs > 0 && (
                  <p className="text-[10px] text-[#c9a84c] font-mono mt-0.5">
                    {formatRemaining(remainingMs)}
                  </p>
                )}
              </div>

              {/* Connector line */}
              {i < PHASES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 min-w-[20px] ${
                    isPast ? "bg-[#c9a84c]/40" : isFuture ? "bg-border" : "bg-gradient-to-r from-[#c9a84c]/40 to-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
