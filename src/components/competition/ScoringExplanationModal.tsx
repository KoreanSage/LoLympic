"use client";

import { useTranslation } from "@/i18n";
import { useEffect } from "react";

interface ScoringExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScoringExplanationModal({
  isOpen,
  onClose,
}: ScoringExplanationModalProps) {
  const { t } = useTranslation();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections = [
    {
      title: t("scoring.countryTitle"),
      desc: t("scoring.countryDesc"),
      formula: null,
    },
    {
      title: t("scoring.creatorTitle"),
      desc: t("scoring.creatorDesc"),
      formula: t("scoring.creatorFormula"),
    },
    {
      title: t("scoring.memeTitle"),
      desc: t("scoring.memeDesc"),
      formula: t("scoring.memeFormula"),
      extra: t("scoring.memeDecay"),
    },
    {
      title: t("scoring.medalsTitle"),
      desc: t("scoring.medalsDesc"),
      formula: null,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-md bg-background-surface border border-border rounded-2xl p-6 space-y-5 animate-in zoom-in-95 fade-in duration-200 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2 className="text-lg font-bold text-[#c9a84c] text-center">
          {t("scoring.howItWorks")}
        </h2>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <h3 className="text-sm font-semibold text-[#c9a84c]">
                {section.title}
              </h3>
              <p className="text-xs text-foreground-muted">{section.desc}</p>
              {section.formula && (
                <div className="font-mono bg-background-elevated rounded px-3 py-2 text-xs text-foreground">
                  {section.formula}
                </div>
              )}
              {(section as any).extra && (
                <p className="text-[10px] text-foreground-subtle italic">
                  {(section as any).extra}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Got it button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#c9a84c] text-white text-sm font-semibold hover:bg-[#b8973f] transition-colors"
        >
          {t("scoring.gotIt")}
        </button>
      </div>
    </div>
  );
}
