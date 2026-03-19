"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";

export default function Footer() {
  const { t } = useTranslation();

  const LEGAL_LINKS = [
    { label: t("footer.terms"), href: "/terms" },
    { label: t("footer.privacy"), href: "/terms#privacy" },
    { label: t("footer.cookies"), href: "/terms#cookies" },
    { label: t("footer.rules"), href: "/rules" },
    { label: t("footer.copyright"), href: "/terms#copyright" },
  ];

  return (
    <footer className="border-t border-border mt-12 py-6">
      <div className="max-w-[1280px] mx-auto px-4">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-3">
          {LEGAL_LINKS.map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className="text-xs text-foreground-subtle hover:text-foreground-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-center text-[10px] text-foreground-subtle">
          {t("footer.allRights", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
