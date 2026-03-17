import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Rules | LoLympic",
  description:
    "LoLympic community rules and guidelines. Learn about our standards for respectful, fun, and safe meme sharing across cultures.",
  openGraph: {
    title: "Community Rules | LoLympic",
    description:
      "LoLympic community rules and guidelines for respectful meme sharing across cultures.",
  },
};

export default function RulesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
