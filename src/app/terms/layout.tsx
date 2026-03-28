import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal - Terms, Privacy & Copyright | mimzy",
  description:
    "mimzy Terms of Service, Privacy Policy, Copyright & DMCA Policy, and Cookie Policy. Learn how we handle your data and your rights as a user.",
  openGraph: {
    title: "Legal - Terms, Privacy & Copyright | mimzy",
    description:
      "mimzy Terms of Service, Privacy Policy, Copyright & DMCA Policy, and Cookie Policy.",
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
