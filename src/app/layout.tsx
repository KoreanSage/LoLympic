import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import ThemeProvider from "@/components/providers/ThemeProvider";
import I18nProvider from "@/components/providers/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import CookieConsent from "@/components/legal/CookieConsent";

export const metadata: Metadata = {
  title: {
    default: "mimzy",
    template: "%s | mimzy",
  },
  description:
    "Your Memes. 7 Languages. One Global Stage.",
  keywords: [
    "meme",
    "translation",
    "AI",
    "global",
    "comedy",
    "culture",
    "mimzy",
  ],
  authors: [{ name: "mimzy" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "mimzy",
    title: "mimzy",
    description:
      "Your Memes. 7 Languages. One Global Stage.",
  },
  twitter: {
    card: "summary_large_image",
    title: "mimzy",
    description:
      "Your Memes. 7 Languages. One Global Stage.",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Inline script to prevent FOUC — reads theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'dark';
                  document.documentElement.className = theme;
                  var lang = localStorage.getItem('uiLanguage') || 'en';
                  document.documentElement.lang = lang;
                } catch(e) { console.error('Failed to read theme/lang from localStorage:', e); }
              })();
            `,
          }}
        />
        {/* Register service worker for offline support */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <SessionProvider>
          <I18nProvider>
            <ThemeProvider>
              <ToastProvider>
                {children}
                <CookieConsent />
              </ToastProvider>
            </ThemeProvider>
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
