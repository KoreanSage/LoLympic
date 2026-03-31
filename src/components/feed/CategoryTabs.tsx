"use client";

import { useRouter, useSearchParams } from "next/navigation";

const CATEGORIES = [
  { key: "", label: "All" },
  { key: "gaming", label: "🎮 Gaming" },
  { key: "animals", label: "🐾 Animals" },
  { key: "politics", label: "🏛️ Politics" },
  { key: "trending", label: "📈 Trending" },
  { key: "sports", label: "⚽ Sports" },
  { key: "other", label: "💬 Other" },
] as const;

export default function CategoryTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("category") || "";

  const setCategory = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key) params.set("category", key);
    else params.delete("category");
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          onClick={() => setCategory(c.key)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            current === c.key
              ? "bg-[#c9a84c] text-black"
              : "bg-background-surface border border-border text-foreground-muted hover:border-[#c9a84c]/40 hover:text-foreground"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
