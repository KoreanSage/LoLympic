"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/i18n";

const COUNTRIES = [
  { id: "KR", flag: "\u{1F1F0}\u{1F1F7}", name: "South Korea" },
  { id: "US", flag: "\u{1F1FA}\u{1F1F8}", name: "United States" },
  { id: "GB", flag: "\u{1F1EC}\u{1F1E7}", name: "United Kingdom" },
  { id: "AU", flag: "\u{1F1E6}\u{1F1FA}", name: "Australia" },
  { id: "CA", flag: "\u{1F1E8}\u{1F1E6}", name: "Canada" },
  { id: "JP", flag: "\u{1F1EF}\u{1F1F5}", name: "Japan" },
  { id: "CN", flag: "\u{1F1E8}\u{1F1F3}", name: "China" },
  { id: "TW", flag: "\u{1F1F9}\u{1F1FC}", name: "Taiwan" },
  { id: "HK", flag: "\u{1F1ED}\u{1F1F0}", name: "Hong Kong" },
  { id: "MX", flag: "\u{1F1F2}\u{1F1FD}", name: "Mexico" },
  { id: "ES", flag: "\u{1F1EA}\u{1F1F8}", name: "Spain" },
  { id: "AR", flag: "\u{1F1E6}\u{1F1F7}", name: "Argentina" },
  { id: "CO", flag: "\u{1F1E8}\u{1F1F4}", name: "Colombia" },
  { id: "CL", flag: "\u{1F1E8}\u{1F1F1}", name: "Chile" },
  { id: "IN", flag: "\u{1F1EE}\u{1F1F3}", name: "India" },
  { id: "SA", flag: "\u{1F1F8}\u{1F1E6}", name: "Saudi Arabia" },
  { id: "EG", flag: "\u{1F1EA}\u{1F1EC}", name: "Egypt" },
  { id: "AE", flag: "\u{1F1E6}\u{1F1EA}", name: "UAE" },
];

export default function SignUpPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [countryId, setCountryId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.passwordMinLength8"));
      return;
    }
    if (!countryId) {
      setError(t("auth.selectCountryError"));
      return;
    }
    if (!agreedToTerms) {
      setError(t("auth.agreeTerms"));
      return;
    }

    setLoading(true);

    // 1. Create account via API
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        username,
        password,
        countryId,
        displayName: username,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || t("auth.signUpFailed"));
      setLoading(false);
      return;
    }

    // 2. Auto-login after signup
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t("auth.signUpSuccessLoginFailed"));
    } else {
      router.push("/onboarding");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-foreground">mi</span>
              <span className="text-[#c9a84c]">mzy</span>
            </h1>
          </Link>
          <p className="mt-2 text-foreground-subtle text-sm">
            {t("auth.joinPlatform")}
          </p>
        </div>

        {/* Sign Up Form */}
        <div className="bg-background-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">
            {t("auth.signUp")}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1.5">
                {t("auth.username")}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="meme_master"
                className="w-full px-3 py-2.5 bg-background-elevated border border-border-hover rounded-lg text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1.5">
                {t("auth.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 bg-background-elevated border border-border-hover rounded-lg text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1.5">
                {t("auth.country")}
              </label>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className="w-full px-3 py-2.5 bg-background-elevated border border-border-hover rounded-lg text-foreground focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
                required
              >
                <option value="">{t("auth.selectCountry")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1.5">
                {t("auth.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder8")}
                className="w-full px-3 py-2.5 bg-background-elevated border border-border-hover rounded-lg text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
                required
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1.5">
                {t("auth.confirmPassword")}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("auth.reenterPassword")}
                className="w-full px-3 py-2.5 bg-background-elevated border border-border-hover rounded-lg text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
                required
                minLength={8}
              />
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border-active accent-[#c9a84c]"
              />
              <span className="text-xs text-foreground-muted leading-relaxed">
                {t("auth.agreeTermsLabel")}{" "}
                <Link href="/terms" className="text-[#c9a84c] hover:underline" target="_blank">
                  {t("auth.termsAndPrivacy")}
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full py-2.5 bg-[#c9a84c] hover:bg-[#d4b65e] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("auth.creatingAccount") : t("auth.signUp")}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-background-overlay" />
            <span className="text-xs text-foreground-subtle uppercase">{t("auth.orContinueWith")}</span>
            <div className="flex-1 h-px bg-background-overlay" />
          </div>

          {/* Google Sign Up */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-gray-100 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t("auth.continueWithGoogle")}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-foreground-subtle">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="text-[#c9a84c] hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
