"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useTranslation } from "@/i18n";

const COUNTRIES = [
  { id: "KR", name: "South Korea", flag: "\u{1F1F0}\u{1F1F7}", local: "\uB300\uD55C\uBBFC\uAD6D" },
  { id: "US", name: "United States", flag: "\u{1F1FA}\u{1F1F8}", local: "United States" },
  { id: "JP", name: "Japan", flag: "\u{1F1EF}\u{1F1F5}", local: "\u65E5\u672C" },
  { id: "CN", name: "China", flag: "\u{1F1E8}\u{1F1F3}", local: "\u4E2D\u56FD" },
  { id: "MX", name: "Mexico", flag: "\u{1F1F2}\u{1F1FD}", local: "M\u00E9xico" },
];

export default function WelcomePage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(
    (session?.user as any)?.displayName || session?.user?.name || ""
  );

  // Redirect if not logged in or if profile is already set up
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && !(session?.user as any)?.needsSetup) {
      router.replace("/");
    }
  }, [status, session, router]);
  const [countryId, setCountryId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate
    if (!username.trim() || username.length < 3 || username.length > 30) {
      setError("Username must be 3-30 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }
    if (!countryId) {
      setError("Please select your country");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          countryId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      // Refresh the session to pick up new username
      await updateSession();

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-[#c9a84c]">LoL</span>
            <span className="text-foreground">ympic</span>
          </h1>
          <p className="text-lg text-foreground-muted">{t("welcome.subtitle")}</p>
          <p className="text-sm text-foreground-subtle mt-1">
            {t("settings.selectCountry")}
          </p>
        </div>

        {/* Season Info Banner */}
        <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl p-4 mb-4 text-center">
          <p className="text-sm font-medium text-[#c9a84c] mb-1">
            🏆 Global Meme Olympics
          </p>
          <p className="text-xs text-foreground-muted">
            Upload memes, get them translated to 7 languages by AI, and compete
            for your country! The most liked meme each month wins, and at
            year&apos;s end, the champion gets eternal glory.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-background-surface border border-border rounded-2xl p-6 space-y-5"
        >
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              Username <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle text-sm">
                @
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                placeholder="your_username"
                className="w-full bg-background-elevated border border-border-hover rounded-lg pl-8 pr-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                maxLength={30}
                autoFocus
              />
            </div>
            <p className="text-[10px] text-foreground-subtle mt-1">
              3-30 characters, letters, numbers, underscore
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              {t("settings.displayName")}
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
              maxLength={50}
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              {t("settings.country")} <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {COUNTRIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCountryId(c.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    countryId === c.id
                      ? "border-[#c9a84c] bg-[#c9a84c]/10 text-foreground"
                      : "border-border bg-background-elevated text-foreground-muted hover:border-border-active"
                  }`}
                >
                  <span className="text-2xl">{c.flag}</span>
                  <div>
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-foreground-subtle ml-2">{c.local}</span>
                  </div>
                  {countryId === c.id && (
                    <svg className="w-5 h-5 text-[#c9a84c] ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={saving || !username.trim() || !countryId}
            className="w-full"
          >
            {saving ? t("settings.saving") : t("common.save")}
          </Button>
        </form>
      </div>
    </div>
  );
}
