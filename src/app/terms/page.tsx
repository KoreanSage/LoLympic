"use client";

import { Suspense, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { getLegalContent } from "@/lib/legal-content";

function HashScroller() {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const el = document.getElementById(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    }
  }, []);
  return null;
}

export default function TermsPage() {
  const { locale } = useTranslation();
  const content = getLegalContent(locale);

  const SECTIONS = [
    { id: "terms", label: content.nav.terms },
    { id: "privacy", label: content.nav.privacy },
    { id: "copyright", label: content.nav.copyright },
    { id: "cookies", label: content.nav.cookies },
  ];

  return (
    <MainLayout showSidebar={false}>
      <Suspense fallback={null}>
        <HashScroller />
      </Suspense>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-3">{content.pageTitle}</h1>
          <p className="text-sm text-foreground-subtle">{content.lastUpdated}</p>
        </div>

        {/* Quick nav */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-background-elevated border border-border text-foreground-muted hover:border-border-active hover:text-foreground transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>

        {/* Terms of Service */}
        <section id="terms" className="mb-12 scroll-mt-24">
          <SectionHeading>{content.sections.terms.title}</SectionHeading>
          {content.sections.terms.blocks.map((block, i) => (
            <LegalBlock key={i} title={block.title} content={block.content} list={block.list} />
          ))}
        </section>

        {/* Privacy Policy */}
        <section id="privacy" className="mb-12 scroll-mt-24">
          <SectionHeading>{content.sections.privacy.title}</SectionHeading>
          {content.sections.privacy.blocks.map((block, i) => (
            <LegalBlock key={i} title={block.title} content={block.content} list={block.list} />
          ))}
        </section>

        {/* Copyright & DMCA */}
        <section id="copyright" className="mb-12 scroll-mt-24">
          <SectionHeading>{content.sections.copyright.title}</SectionHeading>
          {content.sections.copyright.blocks.map((block, i) => (
            <LegalBlock key={i} title={block.title} content={block.content} list={block.list} />
          ))}
        </section>

        {/* Cookie Policy */}
        <section id="cookies" className="mb-12 scroll-mt-24">
          <SectionHeading>{content.sections.cookies.title}</SectionHeading>
          {content.sections.cookies.blocks.map((block, i) => (
            <LegalBlock key={i} title={block.title} content={block.content} list={block.list} />
          ))}
        </section>

        {/* Contact Information */}
        <section className="mb-8">
          <SectionHeading>{content.contact.title}</SectionHeading>
          <div className="bg-background-surface border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <span className="text-foreground-muted w-32 flex-shrink-0 font-medium">{content.contact.legalInquiries}</span>
              <span className="text-[#c9a84c]">dkdnel95@gmail.com</span>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-foreground-muted w-32 flex-shrink-0 font-medium">{content.contact.dmcaNotices}</span>
              <span className="text-[#c9a84c]">dkdnel95@gmail.com</span>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-foreground-muted w-32 flex-shrink-0 font-medium">{content.contact.generalSupport}</span>
              <span className="text-[#c9a84c]">dkdnel95@gmail.com</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-foreground-subtle space-y-2 pt-4 border-t border-border">
          <div className="flex items-center justify-center gap-4">
            <Link href="/rules" className="text-foreground-subtle hover:text-foreground-muted transition-colors">
              {content.footer.communityRules}
            </Link>
            <Link href="/settings" className="text-foreground-subtle hover:text-foreground-muted transition-colors">
              {content.footer.settings}
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-bold text-foreground mb-6 pb-3 border-b border-border">
      {children}
    </h2>
  );
}

function LegalBlock({ title, content, list }: { title: string; content: string; list?: string[] }) {
  // Split content by \n\n for paragraph breaks
  const paragraphs = content.split("\n\n");

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-foreground-muted mb-2">{title}</h3>
      <div className="text-sm text-foreground-muted leading-relaxed">
        {paragraphs.map((para, i) => {
          // Check if paragraph has a bold label pattern like "Account Data:" or "Authentication:"
          const labelMatch = para.match(/^([^:]+?):\s([\s\S]+)$/);
          if (labelMatch) {
            return (
              <span key={i} className={i > 0 ? "block mt-3" : "block"}>
                <strong className="text-foreground-muted">{labelMatch[1]}:</strong> {labelMatch[2]}
              </span>
            );
          }
          return (
            <span key={i} className={i > 0 ? "block mt-3" : "block"}>
              {para}
            </span>
          );
        })}
      </div>
      {list && (
        <div className="bg-background-surface border border-border rounded-xl p-5 mt-3">
          <ul className="space-y-2 text-sm text-foreground-muted">
            {list.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-[#c9a84c] mt-0.5">{i + 1}.</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
