"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/i18n";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t("auth.invalidCredentials"));
    } else {
      router.push("/");
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
              <span className="text-[#c9a84c]">LoL</span>
              <span className="text-foreground">ympic</span>
            </h1>
          </Link>
          <p className="mt-2 text-foreground-subtle text-sm">
            Global Meme Translation Platform
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-background-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">{t("auth.signIn")}</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                {t("auth.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-background-elevated border border-border-hover rounded-lg text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
                required
              />
            </div>

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-foreground-subtle hover:text-[#c9a84c] transition-colors"
              >
                {t("auth.forgotPassword") || "Forgot password?"}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#c9a84c] hover:bg-[#d4b65e] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-background-overlay" />
            <span className="text-xs text-foreground-subtle uppercase">{t("auth.orContinueWith")}</span>
            <div className="flex-1 h-px bg-background-overlay" />
          </div>

          {/* Google Sign In */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/welcome" })}
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

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-foreground-subtle">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="text-[#c9a84c] hover:underline">
            {t("auth.signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
