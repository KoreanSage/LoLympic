"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
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
        </div>

        <div className="bg-background-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {t("auth.forgotPassword") || "Forgot Password"}
          </h2>
          <p className="text-sm text-foreground-subtle mb-6">
            {t("auth.forgotPasswordDescription") ||
              "Enter your email and we'll send you a reset link."}
          </p>

          {submitted ? (
            <div className="text-center py-4">
              <p className="text-green-400 text-sm mb-4">
                {t("auth.resetLinkSent") ||
                  "If an account with that email exists, a reset link has been generated. Check the server logs for the link."}
              </p>
              <Link
                href="/login"
                className="text-[#c9a84c] hover:underline text-sm"
              >
                {t("auth.backToSignIn") || "Back to Sign In"}
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1.5">
                    {t("auth.email") || "Email"}
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#c9a84c] hover:bg-[#d4b65e] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? t("auth.sending") || "Sending..."
                    : t("auth.sendResetLink") || "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-foreground-subtle">
          {t("auth.rememberPassword") || "Remember your password?"}{" "}
          <Link href="/login" className="text-[#c9a84c] hover:underline">
            {t("auth.signIn") || "Sign In"}
          </Link>
        </p>
      </div>
    </div>
  );
}
