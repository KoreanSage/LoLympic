"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();

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

          <div className="py-4">
            <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 text-sm font-medium mb-1">
                Coming Soon
              </p>
              <p className="text-foreground-subtle text-sm">
                Email-based password reset is not yet available. We are working
                on adding email delivery. In the meantime, please contact
                support if you need to reset your password.
              </p>
            </div>

            <Link
              href="/login"
              className="block text-center text-[#c9a84c] hover:underline text-sm"
            >
              {t("auth.backToSignIn") || "Back to Sign In"}
            </Link>
          </div>
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
