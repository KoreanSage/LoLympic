"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/i18n";

function ResetPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 text-sm mb-4">
          Invalid or missing reset token.
        </p>
        <Link href="/forgot-password" className="text-[#c9a84c] hover:underline text-sm">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background-surface border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-2">
        {t("auth.resetPassword") || "Reset Password"}
      </h2>
      <p className="text-sm text-foreground-subtle mb-6">
        {t("auth.enterNewPassword") || "Enter your new password below."}
      </p>

      {success ? (
        <div className="text-center py-4">
          <p className="text-green-400 text-sm mb-4">
            {t("auth.passwordResetSuccess") ||
              "Password reset successfully! Redirecting to sign in..."}
          </p>
          <Link
            href="/login"
            className="text-[#c9a84c] hover:underline text-sm"
          >
            {t("auth.signIn") || "Sign In"}
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
                {t("auth.newPassword") || "New Password"}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-background-elevated border border-border-hover rounded-lg text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-muted mb-1.5">
                {t("auth.confirmPassword") || "Confirm Password"}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-background-elevated border border-border-hover rounded-lg text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/50 transition-colors"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#c9a84c] hover:bg-[#d4b65e] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? t("auth.resetting") || "Resetting..."
                : t("auth.resetPassword") || "Reset Password"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
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

        <Suspense
          fallback={
            <div className="bg-background-surface border border-border rounded-xl p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-background-elevated rounded w-40" />
                <div className="h-10 bg-background-elevated rounded" />
                <div className="h-10 bg-background-elevated rounded" />
              </div>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
