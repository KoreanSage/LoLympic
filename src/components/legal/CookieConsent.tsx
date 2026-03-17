"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) {
      // Small delay for smooth entrance
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = (level: "all" | "necessary") => {
    localStorage.setItem("cookie_consent", level);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] animate-slide-up">
      <div className="max-w-4xl mx-auto px-4 pb-4">
        <div className="bg-background-surface border border-border rounded-xl p-4 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground-muted">
                We use cookies for authentication and to improve your experience.
                By continuing, you agree to our{" "}
                <Link
                  href="/terms#cookies"
                  className="text-[#c9a84c] hover:underline"
                >
                  Cookie Policy
                </Link>
                {" "}and{" "}
                <Link
                  href="/terms#privacy"
                  className="text-[#c9a84c] hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleAccept("necessary")}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-foreground-muted border border-border-active hover:bg-background-elevated transition-colors"
              >
                Necessary Only
              </button>
              <button
                onClick={() => handleAccept("all")}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#c9a84c] text-black hover:bg-[#d4b85c] transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
