"use client";

import { useState, useEffect } from "react";
import TopNav from "./TopNav";
import Sidebar from "./Sidebar";
import Footer from "./Footer";

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  sidebarContent?: React.ReactNode;
}

export default function MainLayout({
  children,
  showSidebar = true,
  sidebarContent,
}: MainLayoutProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TopNav />

      {/* Main content area — offset for fixed nav + season bar */}
      <div className="max-w-[1280px] mx-auto px-4 pt-24 flex-1 w-full">
        {showSidebar ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <main className="min-w-0">{children}</main>
            <div className="hidden lg:block">
              {sidebarContent || <Sidebar />}
            </div>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </div>

      <Footer />

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 left-4 z-40 w-10 h-10 rounded-full bg-background-surface border border-border hover:border-[#c9a84c]/50 text-foreground-muted hover:text-[#c9a84c] flex items-center justify-center shadow-lg transition-all"
          aria-label="Scroll to top"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
