"use client";

import { useSession } from "next-auth/react";
import Card from "@/components/ui/Card";

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
  className = "",
}: CultureNoteCardProps) {
  const { data: session } = useSession();
  const preferredLang = (session?.user as any)?.preferredLanguage || "en";
  const textDir = preferredLang === "ar" ? "rtl" as const : "ltr" as const;

  // Show only one concise note — prefer summary, fallback to explanation
  const note = summary || explanation;
  if (!note) return null;

  return (
    <Card className={`${className}`} dir={textDir}>
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0">{"\u{1F4A1}"}</span>
        <p className="text-sm text-foreground-muted leading-relaxed">{note}</p>
      </div>
    </Card>
  );
}
