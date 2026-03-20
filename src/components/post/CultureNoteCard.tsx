"use client";

import { useSession } from "next-auth/react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

const CARD_LABELS: Record<string, { summary: string; culturalContext: string; translationNote: string }> = {
  ko: { summary: "요약", culturalContext: "문화적 맥락", translationNote: "번역 노트" },
  en: { summary: "Summary", culturalContext: "Cultural Context", translationNote: "Translation Note" },
  ja: { summary: "概要", culturalContext: "文化的背景", translationNote: "翻訳ノート" },
  zh: { summary: "摘要", culturalContext: "文化背景", translationNote: "翻译说明" },
  es: { summary: "Resumen", culturalContext: "Contexto cultural", translationNote: "Nota de traducción" },
};

interface CultureNoteCardProps {
  id: string;
  summary: string;
  explanation: string;
  translationNote?: string | null;
  creatorType: string;
  status: string;
  className?: string;
}

export default function CultureNoteCard({
  summary,
  explanation,
  translationNote,
  creatorType,
  status,
  className = "",
}: CultureNoteCardProps) {
  const { data: session } = useSession();
  const preferredLang = (session?.user as any)?.preferredLanguage || "en";
  const labels = CARD_LABELS[preferredLang] || CARD_LABELS.en;
  const creatorBadgeVariant =
    creatorType === "AI" ? "info" : creatorType === "ADMIN" ? "gold" : "default";

  const statusVariant =
    status === "APPROVED"
      ? "success"
      : status === "PUBLISHED"
      ? "success"
      : status === "REJECTED"
      ? "danger"
      : "warning";

  return (
    <Card className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={creatorBadgeVariant} size="sm">
            {creatorType}
          </Badge>
          <Badge variant={statusVariant} size="sm">
            {status}
          </Badge>
        </div>
      </div>

      {/* Summary */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-foreground-subtle mb-1">
          {labels.summary}
        </h4>
        <p className="text-sm text-foreground-muted leading-relaxed">{summary}</p>
      </div>

      {/* Explanation */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-foreground-subtle mb-1">
          {labels.culturalContext}
        </h4>
        <p className="text-sm text-foreground-muted leading-relaxed">{explanation}</p>
      </div>

      {/* Translation Note */}
      {translationNote && (
        <div className="border-t border-border pt-3">
          <h4 className="text-xs uppercase tracking-wider text-foreground-subtle mb-1">
            {labels.translationNote}
          </h4>
          <p className="text-sm text-foreground-muted leading-relaxed italic">
            {translationNote}
          </p>
        </div>
      )}
    </Card>
  );
}
