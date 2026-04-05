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
      className={`relative inline-flex rounded-full bg-background-elevated border border-border p-0.5 cursor-pointer ${className}`}
      onClick={() => onChange(!showTranslation)}
    >
      {/* Sliding indicator */}
      <div
        className={`absolute top-0.5 bottom-0.5 rounded-full transition-all duration-300 ease-out ${
          showTranslation
            ? "bg-[#c9a84c] left-[calc(50%-2px)] right-0.5"
            : "bg-background-overlay left-0.5 right-[calc(50%-2px)]"
        }`}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onChange(false); }}
        className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 ${
          !showTranslation ? "text-foreground" : "text-foreground-subtle"
        }`}
      >
        {originalLabel}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onChange(true); }}
        className={`relative z-10 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors duration-200 ${
          showTranslation ? "text-black" : "text-foreground-subtle"
        }`}
      >
        {translatedLabel}
      </button>
    </div>
  );
}
