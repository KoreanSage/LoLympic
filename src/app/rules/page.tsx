"use client";

import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";

const RULES = [
  {
    title: "Be Respectful",
    description:
      "Treat all community members with respect. No personal attacks, harassment, bullying, or hate speech of any kind. We celebrate humor from every culture.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    title: "Original Content Only",
    description:
      "Upload memes you created or have rights to share. Do not claim someone else's work as your own. If you're sharing an existing meme, credit the original creator.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: "No Harmful Content",
    description:
      "Do not post content that promotes violence, illegal activities, self-harm, or exploitation. Memes should be fun, not harmful.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  {
    title: "No Spam or Self-Promotion",
    description:
      "Do not post repetitive content, advertisements, or use the platform solely for promoting external products or services.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Translation Quality",
    description:
      "When suggesting translation edits, aim for cultural accuracy. Translations should capture the spirit and humor, not just literal meaning. Respect the nuances of each language.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
  },
  {
    title: "Appropriate Tagging",
    description:
      "Use accurate categories and tags for your memes. Misleading tags hurt discoverability and the community experience.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    title: "Respect Cultural Differences",
    description:
      "Humor varies across cultures. What's funny in one culture may be offensive in another. Engage with curiosity and openness, not judgment.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Report, Don't Retaliate",
    description:
      "If you see rule-breaking content, use the report button. Do not engage in arguments or retaliate. Let moderators handle it.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
  },
];

const ENFORCEMENT = [
  { level: "First Offense", action: "Warning via notification", color: "text-yellow-400" },
  { level: "Second Offense", action: "Content removal + 24-hour posting restriction", color: "text-orange-400" },
  { level: "Third Offense", action: "7-day account suspension", color: "text-red-400" },
  { level: "Severe Violation", action: "Permanent ban (no warnings for hate speech, illegal content, etc.)", color: "text-red-500" },
];

export default function RulesPage() {
  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">Community Rules</h1>
          <p className="text-sm text-foreground-subtle max-w-lg mx-auto">
            LoLympic is a global platform for sharing and translating memes across languages and cultures.
            These rules help keep our community fun, safe, and welcoming for everyone.
          </p>
        </div>

        {/* Rules list */}
        <div className="space-y-4 mb-12">
          {RULES.map((rule, i) => (
            <div
              key={i}
              className="flex gap-4 p-5 bg-background-surface border border-border rounded-xl"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#c9a84c]/10 text-[#c9a84c] flex items-center justify-center">
                {rule.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {i + 1}. {rule.title}
                </h3>
                <p className="text-sm text-foreground-muted leading-relaxed">{rule.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Enforcement */}
        <div className="bg-background-surface border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Enforcement</h2>
          <div className="space-y-3">
            {ENFORCEMENT.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-xs font-bold ${item.color} mt-0.5 w-28 flex-shrink-0`}>
                  {item.level}
                </span>
                <span className="text-sm text-foreground-muted">{item.action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer links */}
        <div className="text-center text-xs text-foreground-subtle space-y-2">
          <p>
            Questions about these rules?{" "}
            <span className="text-[#c9a84c]">Contact us at dkdnel95@gmail.com</span>
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/terms" className="text-foreground-subtle hover:text-foreground-muted transition-colors">
              Terms of Service
            </Link>
            <Link href="/terms#privacy" className="text-foreground-subtle hover:text-foreground-muted transition-colors">
              Privacy Policy
            </Link>
            <Link href="/settings" className="text-foreground-subtle hover:text-foreground-muted transition-colors">
              Settings
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
