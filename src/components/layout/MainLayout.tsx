"use client";

import TopNav from "./TopNav";
import Sidebar from "./Sidebar";
import Footer from "./Footer";

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export default function MainLayout({
  children,
  showSidebar = true,
}: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <TopNav />

      {/* Main content area — offset for fixed nav + season bar */}
      <div className="max-w-[1280px] mx-auto px-4 pt-[7.5rem] flex-1 w-full">
        {showSidebar ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <main className="min-w-0">{children}</main>
            <div className="hidden lg:block">
              <Sidebar />
            </div>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </div>

      <Footer />
    </div>
  );
}
