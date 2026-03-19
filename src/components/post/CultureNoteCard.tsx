"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useTranslation } from "@/i18n";

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
  const { t } = useTranslation();
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
          {t("cultureNote.title")}
        </h4>
        <p className="text-sm text-foreground-muted leading-relaxed">{summary}</p>
      </div>

      {/* Explanation */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-foreground-subtle mb-1">
          {t("cultureNote.aiGenerated")}
        </h4>
        <p className="text-sm text-foreground-muted leading-relaxed">{explanation}</p>
      </div>

      {/* Translation Note */}
      {translationNote && (
        <div className="border-t border-border pt-3">
          <h4 className="text-xs uppercase tracking-wider text-foreground-subtle mb-1">
            Translation Note
          </h4>
          <p className="text-sm text-foreground-muted leading-relaxed italic">
            {translationNote}
          </p>
        </div>
      )}
    </Card>
  );
}
