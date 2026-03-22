"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import SeasonBar from "@/components/competition/SeasonBar";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";

interface NotificationData {
  id: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  actor?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
  post?: {
    id: string;
    title: string;
  } | null;
  comment?: {
    id: string;
    body: string;
  } | null;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function notifText(n: NotificationData, t: (key: any, params?: any) => string): string {
  const actor = n.actor?.displayName || n.actor?.username || "Someone";
  switch (n.type) {
    case "REACTION":
      return t("notif.reaction", { actor });
    case "COMMENT":
      return t("notif.comment", { actor });
    case "REPLY":
      return t("notif.reply", { actor });
    case "SUGGESTION":
      return t("notif.suggestion", { actor });
    case "SUGGESTION_APPROVED":
      return t("notif.suggestionApproved");
    case "FOLLOW":
      return t("notif.follow", { actor });
    case "MEDAL_AWARDED":
      return t("notif.medal");
    case "SEASON_START":
      return t("notif.seasonStart");
    case "SEASON_END":
      return t("notif.seasonEnd");
    case "SYSTEM": {
      const meta = n.metadata as Record<string, unknown> | null;
      if (meta?.subtype === "MONTHLY_WINNER") {
        return t("notif.monthlyWinner", { month: String(meta.monthName || "") });
      }
      return t("notif.system");
    }
    default:
      return t("notif.new_notification");
  }
}

function notifIcon(type: string): string {
  const icons: Record<string, string> = {
    REACTION: "\u{1F525}",
    COMMENT: "\u{1F4AC}",
    REPLY: "\u{1F4AC}",
    SUGGESTION: "\u{1F30D}",
    SUGGESTION_APPROVED: "\u2705",
    FOLLOW: "\u{1F464}",
    MEDAL_AWARDED: "\u{1F3C5}",
    SEASON_START: "\u{1F3C6}",
    SEASON_END: "\u{1F3C6}",
    SYSTEM: "\u{1F514}",
  };
  return icons[type] || "\u{1F514}";
}

export default function TopNav() {
  const { data: session, status } = useSession();
  const { t } = useTranslation();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [mobileMenuOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchRef.current) {
      searchRef.current.focus();
    }
  }, [showSearch]);

  // Close notifications on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showNotifications]);

  // Fetch unread count on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/notifications?limit=1")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {});
    // Fetch DM unread count
    fetch("/api/conversations/unread")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setDmUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {});
  }, [status]);

  // Fetch notifications when dropdown opens & auto mark as read
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);

        // Auto mark all as read when opening dropdown
        if ((data.unreadCount ?? 0) > 0) {
          fetch("/api/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markAllRead: true }),
          }).then(() => {
            setUnreadCount(0);
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
          }).catch(() => {});
        }
      }
    } catch {
      // ignore
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showNotifications && status === "authenticated") {
      fetchNotifications();
    }
  }, [showNotifications, status, fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      toast("Failed to mark notifications as read", "error");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearch(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const userAvatarUrl = (session?.user as any)?.avatarUrl || session?.user?.image || null;
  const username = (session?.user as any)?.username || "me";
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN";

  // Hide season bar on scroll
  const [hideSeasonBar, setHideSeasonBar] = useState(false);
  useEffect(() => {
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      setHideSeasonBar(y > 40);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border">
      {/* Season bar — hides on scroll */}
      <div
        className="transition-all duration-300 overflow-hidden"
        style={{ maxHeight: hideSeasonBar ? 0 : 60, opacity: hideSeasonBar ? 0 : 1 }}
      >
        <SeasonBar />
      </div>

      {/* Main nav */}
      <nav className="max-w-[1280px] mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: Logo + nav links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#c9a84c]">LoL</span>
              <span className="text-foreground">ympic</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/" label={t("nav.explore")} />
            <NavLink href="/leaderboard" label={t("nav.leaderboard")} />
            <NavLink href="/dashboard" label={t("nav.dashboard")} />
            <NavLink href="/seasons" label={t("nav.season")} />
            <NavLink href="/upload" label={t("nav.upload")} />
            {isAdmin && <NavLink href="/admin" label={t("nav.admin")} />}
          </div>
        </div>

        {/* Right: Search, Notifications, Profile */}
        <div className="flex items-center gap-2">
          {/* Hamburger menu (mobile only) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated transition-colors"
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="true"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Search */}
          {showSearch ? (
            <form onSubmit={handleSearch} className="flex items-center gap-1">
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("nav.searchMemes")}
                className="w-48 px-3 py-1.5 rounded-lg bg-background-elevated border border-border-active text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50"
                onBlur={() => {
                  if (!searchQuery) setShowSearch(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowSearch(false);
                    setSearchQuery("");
                  }
                }}
              />
            </form>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              aria-label={t("nav.search")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-elevated border border-border text-foreground-subtle hover:border-border-active hover:text-foreground-muted transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">{t("nav.search")}</span>
            </button>
          )}

          {/* DM Messages */}
          {status === "authenticated" && (
            <Link
              href="/messages"
              onClick={() => setDmUnreadCount(0)}
              className="relative p-2 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated transition-colors"
              aria-label={t("nav.messages")}
              title={t("nav.messages")}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              {dmUnreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#c9a84c] rounded-full" />
              )}
            </Link>
          )}

          {/* Notifications */}
          {status === "authenticated" && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label={t("notif.title")}
                aria-expanded={showNotifications}
                aria-haspopup="true"
                className="relative p-2 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#c9a84c] rounded-full" />
                )}
              </button>

              {/* Notification dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-background-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{t("notif.title")}</h3>
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#c9a84c]/10 text-[#c9a84c]">
                        {t("notif.new", { count: unreadCount })}
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-sm text-foreground-subtle">{t("notif.empty")}</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 hover:bg-background-elevated transition-colors cursor-pointer border-b border-border last:border-0 ${
                            n.isRead ? "opacity-50" : ""
                          }`}
                          onClick={() => {
                            if (n.post) router.push(`/post/${n.post.id}`);
                            else if (n.actor) router.push(`/user/${n.actor.username}`);
                            setShowNotifications(false);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-base mt-0.5">{notifIcon(n.type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground-muted">{notifText(n, t)}</p>
                              <p className="text-xs text-foreground-subtle mt-0.5">{formatTimeAgo(n.createdAt)}</p>
                            </div>
                            {!n.isRead && (
                              <span className="w-2 h-2 mt-1.5 bg-[#c9a84c] rounded-full flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.length > 0 && unreadCount > 0 && (
                    <div className="px-4 py-2 border-t border-border">
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-[#c9a84c] hover:text-[#d4b85c] transition-colors"
                      >
                        {t("notif.markAllRead")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Profile / Login */}
          {status === "loading" ? (
            <div className="w-8 h-8 rounded-full bg-background-overlay animate-pulse" />
          ) : session?.user ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/user/${username}`}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-background-elevated transition-colors"
                aria-label={`Profile @${username}`}
                title={`@${username}`}
              >
                <Avatar
                  src={userAvatarUrl}
                  alt={(session.user as any).displayName || username}
                  size="sm"
                />
              </Link>
              <Link
                href="/settings"
                className="hidden sm:flex p-2 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated transition-colors"
                aria-label={t("nav.settings")}
                title={t("nav.settings")}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
              >
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#c9a84c] text-black hover:bg-[#b8963f] transition-colors"
            >
              {t("nav.login")}
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        ref={mobileMenuRef}
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3 space-y-1">
          <MobileNavLink href="/" label={t("nav.explore")} active={pathname === "/"} />
          <MobileNavLink href="/leaderboard" label={t("nav.leaderboard")} active={pathname === "/leaderboard"} />
          <MobileNavLink href="/dashboard" label={t("nav.dashboard")} active={pathname === "/dashboard"} />
          <MobileNavLink href="/seasons" label={t("nav.season")} active={pathname?.startsWith("/seasons")} />
          <MobileNavLink href="/upload" label={t("nav.upload")} active={pathname === "/upload"} />
          <MobileNavLink href="/bookmarks" label={t("nav.bookmarks")} active={pathname === "/bookmarks"} />
          {session?.user && (
            <>
              <MobileNavLink href="/messages" label={t("nav.messages")} active={pathname?.startsWith("/messages")} />
              <MobileNavLink href="/settings" label={t("nav.settings")} active={pathname === "/settings"} />
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                {t("nav.logout")}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
    >
      {label}
    </Link>
  );
}

function MobileNavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "text-[#c9a84c] bg-[#c9a84c]/10"
          : "text-foreground-muted hover:text-foreground hover:bg-background-elevated"
      }`}
    >
      {label}
    </Link>
  );
}
