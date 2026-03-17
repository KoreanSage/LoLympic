"use client";

import { Suspense, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";

const SECTIONS = [
  { id: "terms", label: "Terms of Service" },
  { id: "privacy", label: "Privacy Policy" },
  { id: "copyright", label: "Copyright & DMCA" },
  { id: "cookies", label: "Cookies" },
];

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

  return (
    <MainLayout showSidebar={false}>
      <Suspense fallback={null}>
        <HashScroller />
      </Suspense>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-3">Legal</h1>
          <p className="text-sm text-foreground-subtle">Last updated: March 2026</p>
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
          <SectionHeading>Terms of Service</SectionHeading>

          <LegalBlock title="1. Acceptance of Terms">
            By accessing or using LoLympic (&quot;the Service&quot;), you agree to be bound by these
            Terms of Service. If you do not agree, do not use the Service.
          </LegalBlock>

          <LegalBlock title="2. Eligibility">
            You must be at least 13 years old to use LoLympic. If you are under 18, you must have
            parental or guardian consent. By using the Service, you represent that you meet these
            requirements.
          </LegalBlock>

          <LegalBlock title="3. User Accounts">
            You are responsible for maintaining the security of your account credentials. You must
            not share your account with others. You are responsible for all activity under your
            account. Notify us immediately of any unauthorized access.
          </LegalBlock>

          <LegalBlock title="4. User Content">
            You retain ownership of content you upload. By posting content, you grant LoLympic a
            worldwide, non-exclusive, royalty-free license to use, display, reproduce, and distribute
            your content on the platform. You represent that you have the right to share any content
            you upload.
          </LegalBlock>

          <LegalBlock title="5. AI Translation">
            LoLympic uses AI to automatically translate meme content across languages. Translations
            are provided as-is and may not perfectly capture cultural nuances. Community members may
            suggest improved translations. LoLympic is not responsible for inaccuracies in
            AI-generated translations.
          </LegalBlock>

          <LegalBlock title="6. Prohibited Conduct">
            You may not: upload illegal content; harass other users; spam or flood the platform;
            attempt to manipulate votes or leaderboards; circumvent bans or restrictions; use
            automated tools to scrape or bulk-upload content; impersonate other users or entities.
          </LegalBlock>

          <LegalBlock title="7. Termination">
            We may suspend or terminate your account at our discretion for violations of these terms
            or community rules. You may delete your account at any time through Settings.
          </LegalBlock>

          <LegalBlock title="8. Disclaimer">
            The Service is provided &quot;as is&quot; without warranties of any kind. We do not
            guarantee uptime, accuracy of translations, or preservation of content. Use the Service
            at your own risk.
          </LegalBlock>

          <LegalBlock title="9. Changes to Terms">
            We may update these terms at any time. Continued use of the Service after changes
            constitutes acceptance. We will notify users of material changes via the platform.
          </LegalBlock>

          <LegalBlock title="10. Age Restriction">
            You must be at least 13 years old to use LoLympic. By using our platform, you confirm
            that you meet this age requirement.
          </LegalBlock>

          <LegalBlock title="11. Governing Law">
            These terms are governed by the laws of Republic of Korea. Any disputes will be resolved
            in the courts of Seoul, Republic of Korea.
          </LegalBlock>
        </section>

        {/* Privacy Policy */}
        <section id="privacy" className="mb-12 scroll-mt-24">
          <SectionHeading>Privacy Policy</SectionHeading>

          <LegalBlock title="1. Information We Collect">
            <strong className="text-foreground-muted">Account Data:</strong> email address, username, display
            name, and profile information you provide.
            <br /><br />
            <strong className="text-foreground-muted">Content Data:</strong> memes you upload, translations,
            comments, votes, and other interactions.
            <br /><br />
            <strong className="text-foreground-muted">Usage Data:</strong> IP address, browser type, device
            information, pages visited, and actions taken on the platform.
          </LegalBlock>

          <LegalBlock title="2. How We Use Your Information">
            We use your information to: provide and improve the Service; process AI translations;
            personalize your experience; send notifications you&apos;ve opted into; enforce our rules
            and terms; analyze usage patterns to improve the platform.
          </LegalBlock>

          <LegalBlock title="3. Data Sharing">
            We do not sell your personal information. We may share data with: AI service providers
            (for translation processing); hosting and infrastructure providers; law enforcement when
            required by law. Your public profile and posted content are visible to all users.
          </LegalBlock>

          <LegalBlock title="4. Data Retention">
            Account data is retained while your account is active. You may request deletion of your
            account and associated data through Settings. Some data may be retained for legal
            compliance purposes.
          </LegalBlock>

          <LegalBlock title="5. Cookies">
            We use essential cookies for authentication and session management. We use analytics
            cookies to understand platform usage. You can manage cookie preferences in your browser
            settings.
          </LegalBlock>

          <LegalBlock title="6. Your Rights">
            You have the right to: access your personal data; correct inaccurate data; delete your
            account and data; export your data; opt out of non-essential communications.
          </LegalBlock>

          <LegalBlock title="7. Security">
            We implement industry-standard security measures to protect your data. However, no
            system is 100% secure. Report security vulnerabilities to dkdnel95@gmail.com.
          </LegalBlock>
        </section>

        {/* Copyright & DMCA */}
        <section id="copyright" className="mb-12 scroll-mt-24">
          <SectionHeading>Copyright &amp; DMCA Policy</SectionHeading>

          <LegalBlock title="1. Intellectual Property">
            LoLympic respects intellectual property rights. Users retain copyright over their
            original content. AI-generated translations are provided as a service and do not
            transfer copyright.
          </LegalBlock>

          <LegalBlock title="2. Meme Fair Use">
            Many memes incorporate copyrighted images used transformatively for commentary, parody,
            or criticism. LoLympic supports the fair use doctrine but cannot provide legal advice
            on individual cases. Users are responsible for ensuring their uploads comply with
            applicable copyright law.
          </LegalBlock>

          <LegalBlock title="3. DMCA Takedown Process">
            If you believe content on LoLympic infringes your copyright, submit a DMCA takedown
            notice to <span className="text-[#c9a84c]">dkdnel95@gmail.com</span> including:
          </LegalBlock>

          <div className="bg-background-surface border border-border rounded-xl p-5 mb-4">
            <ul className="space-y-2 text-sm text-foreground-muted">
              <li className="flex items-start gap-2">
                <span className="text-[#c9a84c] mt-0.5">1.</span>
                Identification of the copyrighted work
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#c9a84c] mt-0.5">2.</span>
                URL of the infringing content on LoLympic
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#c9a84c] mt-0.5">3.</span>
                Your contact information
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#c9a84c] mt-0.5">4.</span>
                A statement of good faith belief that the use is not authorized
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#c9a84c] mt-0.5">5.</span>
                A statement under penalty of perjury that the information is accurate
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#c9a84c] mt-0.5">6.</span>
                Your physical or electronic signature
              </li>
            </ul>
          </div>

          <LegalBlock title="4. Counter-Notification">
            If your content was removed and you believe it was a mistake, you may submit a
            counter-notification. We will restore the content within 10-14 business days unless the
            copyright holder files a court action.
          </LegalBlock>

          <LegalBlock title="5. Repeat Infringers">
            Accounts with repeated copyright violations will be terminated. Three valid DMCA
            strikes result in permanent account removal.
          </LegalBlock>

          <LegalBlock title="6. Translation Copyright">
            AI-generated translations are a derivative service. Original meme creators retain
            rights over their source content. Community-contributed translation improvements are
            licensed under the same terms as other user content (see Terms of Service, Section 4).
          </LegalBlock>
        </section>

        {/* Cookie Policy */}
        <section id="cookies" className="mb-12 scroll-mt-24">
          <SectionHeading>Cookie Policy</SectionHeading>

          <LegalBlock title="1. What Are Cookies">
            Cookies are small text files stored on your device when you visit a website. They help
            the site remember your preferences and improve your experience. Some cookies are
            essential for the site to function, while others help us understand how you use the
            platform.
          </LegalBlock>

          <LegalBlock title="2. Cookies We Use">
            <span className="block mb-2">We use the following cookies and local storage items:</span>
            <span className="block mb-1">
              <strong className="text-foreground-muted">Authentication:</strong> NextAuth session
              cookie — essential for login. This cookie is required for the Service to function and
              cannot be disabled.
            </span>
            <span className="block mb-1">
              <strong className="text-foreground-muted">Theme Preference:</strong> localStorage —
              remembers your dark/light mode selection so the interface matches your preference on
              return visits.
            </span>
            <span className="block">
              <strong className="text-foreground-muted">Cookie Consent:</strong> localStorage —
              remembers your cookie choice so you are not asked again on every visit.
            </span>
          </LegalBlock>

          <LegalBlock title="3. Third-Party Cookies">
            We do not use any third-party tracking cookies or analytics.
          </LegalBlock>

          <LegalBlock title="4. Managing Cookies">
            You can manage or delete cookies through your browser settings. Note that disabling
            essential cookies may affect your ability to use our services.
          </LegalBlock>
        </section>

        {/* Contact Information */}
        <section className="mb-8">
          <SectionHeading>Contact Information</SectionHeading>
          <div className="bg-background-surface border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3 text-sm">
              <span className="text-foreground-muted w-32 flex-shrink-0 font-medium">Legal inquiries:</span>
              <span className="text-[#c9a84c]">dkdnel95@gmail.com</span>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-foreground-muted w-32 flex-shrink-0 font-medium">DMCA notices:</span>
              <span className="text-[#c9a84c]">dkdnel95@gmail.com</span>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <span className="text-foreground-muted w-32 flex-shrink-0 font-medium">General support:</span>
              <span className="text-[#c9a84c]">dkdnel95@gmail.com</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-foreground-subtle space-y-2 pt-4 border-t border-border">
          <div className="flex items-center justify-center gap-4">
            <Link href="/rules" className="text-foreground-subtle hover:text-foreground-muted transition-colors">
              Community Rules
            </Link>
            <Link href="/settings" className="text-foreground-subtle hover:text-foreground-muted transition-colors">
              Settings
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

function LegalBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-foreground-muted mb-2">{title}</h3>
      <p className="text-sm text-foreground-muted leading-relaxed">{children}</p>
    </div>
  );
}
