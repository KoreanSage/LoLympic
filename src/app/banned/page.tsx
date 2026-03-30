"use client";

import { useSession, signOut } from "next-auth/react";
import { useTranslation } from "@/i18n";
import { Ban } from "lucide-react";

export default function BannedPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-background-surface border border-border rounded-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <Ban className="w-8 h-8 text-red-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">
            {t("ban.banned")}
          </h1>
          <p className="text-sm text-foreground-muted">
            {t("ban.bannedMessage")}
          </p>
        </div>

        {session?.user?.banReason && (
          <div className="bg-background-elevated border border-border rounded-lg p-4 text-left">
            <p className="text-xs font-medium text-foreground-subtle mb-1">
              {t("ban.reason")}
            </p>
            <p className="text-sm text-foreground-muted">
              {session.user.banReason}
            </p>
          </div>
        )}

        <p className="text-xs text-foreground-subtle">
          {t("ban.contactSupport")}
        </p>

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-background-elevated border border-border text-foreground-muted hover:text-foreground hover:border-foreground-subtle transition-colors"
        >
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}
