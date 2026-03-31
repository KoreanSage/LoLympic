"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";

export default function OnboardingFlow() {
  const { t } = useTranslation();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 8;

  const handleSkip = () => {
    router.push("/");
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const steps = [
    // Step 1: Welcome
    <div key="step1" className="flex flex-col items-center text-center space-y-4 px-4">
      <div className="text-6xl">
        <span className="text-[#c9a84c]">mi</span>
        <span className="text-foreground">mzy</span>
      </div>
      <h2 className="text-xl font-bold text-foreground">
        {t("onboarding.step1Title")}
      </h2>
      <p className="text-sm text-foreground-muted">
        {t("onboarding.step1Desc")}
      </p>
      <p className="text-xs text-foreground-subtle">
        {t("onboarding.step1Detail")}
      </p>
    </div>,

    // Step 2: How It Works
    <div key="step2" className="flex flex-col items-center text-center space-y-6 px-4">
      <h2 className="text-xl font-bold text-foreground">
        {t("onboarding.step2Title")}
      </h2>
      <div className="space-y-4 w-full max-w-xs">
        {[
          { icon: "\uD83D\uDCE4", text: t("onboarding.step2Upload") },
          { icon: "\uD83C\uDF10", text: t("onboarding.step2Translate") },
          { icon: "\u2694\uFE0F", text: t("onboarding.step2Compete") },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a84c]/10 flex items-center justify-center text-xl flex-shrink-0">
              {item.icon}
            </div>
            <p className="text-sm text-foreground-muted text-left">{item.text}</p>
            {i < 2 && (
              <span className="text-foreground-subtle text-xs ml-auto">&darr;</span>
            )}
          </div>
        ))}
      </div>
    </div>,

    // Step 3: Meme Battle
    <div key="step3" className="flex flex-col items-center text-center space-y-4 px-4">
      <h2 className="text-xl font-bold text-foreground">
        {t("onboarding.step3BattleTitle")}
      </h2>
      <p className="text-sm text-foreground-muted">
        {t("onboarding.step3BattleDesc")}
      </p>
      {/* Visual: Two meme cards side by side with VS */}
      <div className="flex items-center gap-3 w-full max-w-xs">
        <div className="flex-1 h-24 rounded-xl bg-background-elevated border border-border flex items-center justify-center text-2xl">
          😂
        </div>
        <div className="text-lg font-bold text-[#c9a84c]">VS</div>
        <div className="flex-1 h-24 rounded-xl bg-background-elevated border border-border flex items-center justify-center text-2xl">
          🤣
        </div>
      </div>
    </div>,

    // Step 4: Translation Toggle
    <div key="step4" className="flex flex-col items-center text-center space-y-4 px-4">
      <h2 className="text-xl font-bold text-foreground">
        {t("onboarding.step4TranslationTitle")}
      </h2>
      <p className="text-sm text-foreground-muted">
        {t("onboarding.step4TranslationDesc")}
      </p>
      {/* Visual: Toggle switch illustration */}
      <div className="flex items-center gap-3 w-full max-w-xs justify-center">
        <span className="px-3 py-1.5 rounded-lg bg-background-elevated border border-border text-xs text-foreground-muted">
          Original
        </span>
        <span className="text-[#c9a84c] text-lg">{"\u2192"}</span>
        <span className="px-3 py-1.5 rounded-lg bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-xs text-[#c9a84c] font-medium">
          Translated
        </span>
      </div>
    </div>,

    // Step 5: Rank Up System
    <div key="step5" className="flex flex-col items-center text-center space-y-4 px-4">
      <h2 className="text-xl font-bold text-foreground">
        {t("onboarding.step5RankTitle")}
      </h2>
      <p className="text-sm text-foreground-muted">
        {t("onboarding.step5RankDesc")}
      </p>
      {/* Visual: Tier progression */}
      <div className="flex flex-wrap justify-center gap-1.5 w-full max-w-xs">
        {[
          { name: "Iron", color: "#8B8B8B" },
          { name: "Bronze", color: "#CD7F32" },
          { name: "Silver", color: "#C0C0C0" },
          { name: "Gold", color: "#FFD700" },
          { name: "Platinum", color: "#00CED1" },
          { name: "Diamond", color: "#B9F2FF" },
          { name: "Master", color: "#9B59B6" },
          { name: "Challenger", color: "#FF4444" },
        ].map((tier, i) => (
          <div
            key={tier.name}
            className="flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-medium"
            style={{ borderColor: tier.color, color: tier.color }}
          >
            {tier.name}
            {i < 7 && <span className="text-foreground-subtle ml-0.5">{"\u2192"}</span>}
          </div>
        ))}
      </div>
    </div>,

    // Step 6: Scoring (was old Step 3)
    <div key="step6" className="flex flex-col items-center text-center space-y-4 px-4">
      <h2 className="text-xl font-bold text-foreground">
        {t("onboarding.step6Title")}
      </h2>
      <p className="text-sm text-foreground-muted">
        {t("onboarding.step6Desc")}
      </p>
      <p className="text-xs text-foreground-subtle">
        {t("onboarding.step6Detail")}
      </p>
    </div>,

    // Step 7: Championship System
    <div key="step7" className="flex flex-col items-center text-center space-y-4 px-4">
      <h2 className="text-xl font-bold text-foreground">
        {t("onboarding.step7ChampionshipTitle")}
      </h2>
      <p className="text-sm text-foreground-muted">
        {t("onboarding.step7ChampionshipDesc")}
      </p>
      {/* Visual: Championship flow */}
      <div className="space-y-3 w-full max-w-xs">
        {[
          { icon: "🏳️", text: t("onboarding.step7ChampCountry") },
          { icon: "📊", text: t("onboarding.step7ChampScore") },
          { icon: "🏆", text: t("onboarding.step7ChampBattle") },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#c9a84c]/10 flex items-center justify-center text-xl flex-shrink-0">
              {item.icon}
            </div>
            <p className="text-sm text-foreground-muted text-left">{item.text}</p>
          </div>
        ))}
      </div>
      <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl px-4 py-2 mt-2">
        <p className="text-xs text-[#c9a84c] font-medium">
          {t("onboarding.step7ChampTip")}
        </p>
      </div>
    </div>,

    // Step 8: CTA (was old Step 7)
    <div key="step8" className="flex flex-col items-center text-center space-y-5 px-4">
      <h2 className="text-xl font-bold text-foreground">
        {t("onboarding.step7Title")}
      </h2>
      <div className="space-y-3 w-full max-w-xs">
        <button
          onClick={() => router.push("/upload")}
          className="w-full py-3 rounded-xl bg-[#c9a84c] text-white text-sm font-semibold hover:bg-[#b8973f] transition-colors"
        >
          {t("onboarding.step7Cta")}
        </button>
        <button
          onClick={() => router.push("/")}
          className="w-full py-3 rounded-xl border border-border text-foreground-muted text-sm font-medium hover:bg-background-elevated transition-colors"
        >
          {t("onboarding.step7Browse")}
        </button>
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Skip button */}
      <div className="w-full max-w-md flex justify-end mb-4">
        <button
          onClick={handleSkip}
          className="text-sm text-foreground-subtle hover:text-foreground transition-colors"
        >
          {t("onboarding.skip")}
        </button>
      </div>

      {/* Card with sliding content */}
      <div className="w-full max-w-md bg-background-surface border border-border rounded-2xl p-8 overflow-hidden">
        <div className="relative">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentStep * 100}%)` }}
          >
            {steps.map((step, i) => (
              <div key={i} className="w-full flex-shrink-0">
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mt-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              i === currentStep ? "bg-[#c9a84c]" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-4 w-full max-w-md">
        {currentStep > 0 && (
          <button
            onClick={handleBack}
            className="flex-1 py-2.5 rounded-xl border border-border text-foreground-muted text-sm font-medium hover:bg-background-elevated transition-colors"
          >
            {t("onboarding.back")}
          </button>
        )}
        {currentStep < totalSteps - 1 && (
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-xl bg-[#c9a84c] text-white text-sm font-semibold hover:bg-[#b8973f] transition-colors"
          >
            {t("onboarding.next")}
          </button>
        )}
      </div>
    </div>
  );
}
