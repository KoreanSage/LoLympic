"use client";

// ---------------------------------------------------------------------------
// TranslationProgress — inline UI shown on a post page while async
// translation jobs are in flight. Displays a progress bar and per-language
// status pills, plus a retry button when some languages failed.
// ---------------------------------------------------------------------------
import React from "react";

export interface TranslationPayloadStatus {
  targetLanguage: string;
  status: string;
}

interface TranslationProgressProps {
  summary: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };
  payloads: TranslationPayloadStatus[];
  timedOut?: boolean;
  onRetry?: (failedLangs: string[]) => void;
}

const LANG_LABEL: Record<string, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
  es: "Español",
  hi: "Hinglish",
  ar: "العربية",
};

function StatusDot({ status }: { status: string }) {
  const color =
    status === "COMPLETED" || status === "APPROVED"
      ? "bg-green-400"
      : status === "REJECTED"
      ? "bg-red-400"
      : "bg-yellow-400 animate-pulse";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function TranslationProgress({
  summary,
  payloads,
  timedOut,
  onRetry,
}: TranslationProgressProps) {
  const percent = summary.total > 0
    ? Math.round(((summary.completed + summary.failed) / summary.total) * 100)
    : 0;

  const failedLangs = payloads.filter((p) => p.status === "REJECTED").map((p) => p.targetLanguage);
  const hasFailures = failedLangs.length > 0;

  return (
    <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-yellow-200">
            {timedOut ? "번역이 오래 걸리고 있어요" : "번역 중…"}
          </h3>
        </div>
        <span className="text-xs text-yellow-300/80">
          {summary.completed}/{summary.total} 완료
          {summary.failed > 0 && ` · ${summary.failed} 실패`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-yellow-400 to-yellow-300 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Per-language pills */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {payloads.map((p) => (
          <span
            key={p.targetLanguage}
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
              p.status === "COMPLETED" || p.status === "APPROVED"
                ? "bg-green-400/10 text-green-300"
                : p.status === "REJECTED"
                ? "bg-red-400/10 text-red-300"
                : "bg-yellow-400/10 text-yellow-300"
            }`}
          >
            <StatusDot status={p.status} />
            {LANG_LABEL[p.targetLanguage] || p.targetLanguage}
          </span>
        ))}
      </div>

      {/* Retry button for failed languages */}
      {hasFailures && onRetry && (
        <button
          onClick={() => onRetry(failedLangs)}
          className="mt-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white transition min-h-[32px]"
        >
          실패한 언어 다시 시도 ({failedLangs.length})
        </button>
      )}

      {timedOut && (
        <p className="mt-2 text-xs text-yellow-300/70">
          5분이 지났어요. 페이지를 새로고침하거나 잠시 후 다시 확인해 주세요.
        </p>
      )}
    </div>
  );
}
