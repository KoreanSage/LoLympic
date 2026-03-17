"use client";

interface TranslationToggleProps {
  showTranslation: boolean;
  onChange: (show: boolean) => void;
  originalLabel?: string;
  translatedLabel?: string;
  className?: string;
}

export default function TranslationToggle({
  showTranslation,
  onChange,
  originalLabel = "Original",
  translatedLabel = "Translated",
  className = "",
}: TranslationToggleProps) {
  return (
    <div
      className={`inline-flex rounded-lg bg-background-elevated border border-border p-0.5 ${className}`}
    >
      <button
        onClick={() => onChange(false)}
        className={`
          px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200
          ${
            !showTranslation
              ? "bg-background-overlay text-foreground shadow-sm"
              : "text-foreground-subtle hover:text-foreground-muted"
          }
        `}
      >
        {originalLabel}
      </button>
      <button
        onClick={() => onChange(true)}
        className={`
          px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200
          ${
            showTranslation
              ? "bg-[#c9a84c] text-black shadow-sm"
              : "text-foreground-subtle hover:text-foreground-muted"
          }
        `}
      >
        {translatedLabel}
      </button>
    </div>
  );
}
