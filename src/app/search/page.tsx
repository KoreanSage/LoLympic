"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";

interface PostResult {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  country?: {
    flagEmoji: string;
    nameEn: string;
  } | null;
  images?: Array<{ originalUrl: string }>;
}

interface UserResult {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: {
    flagEmoji: string;
    nameEn: string;
  } | null;
  _count?: {
    followers: number;
    posts: number;
  };
}

export default function SearchPageWrapper() {
  return (
    <Suspense fallback={
      <MainLayout showSidebar={false}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    }>
      <SearchPage />
    </Suspense>
  );
}

const RECENT_SEARCHES_KEY = "lolympic_recent_searches";
const MAX_RECENT_SEARCHES = 5;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read recent searches:", e);
    return [];
  }
}

function addRecentSearch(q: string) {
  if (typeof window === "undefined") return;
  try {
    const searches = getRecentSearches().filter((s) => s !== q);
    searches.unshift(q);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch (e) {
    console.error("Failed to save recent search:", e);
  }
}

function removeRecentSearch(q: string) {
  if (typeof window === "undefined") return;
  try {
    const searches = getRecentSearches().filter((s) => s !== q);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (e) {
    console.error("Failed to remove recent search:", e);
  }
}

function SearchPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState<"posts" | "users">("posts");
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(false);
    // Save to recent searches
    addRecentSearch(q.trim());
    setRecentSearches(getRecentSearches());
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=all&limit=30`
      );
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setUsers(data.users || []);
        setPostCount(data.postCount ?? 0);
        setUserCount(data.userCount ?? 0);
      }
    } catch (e) {
      console.error("Search failed:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) doSearch(query);
  }, [query, doSearch]);

  return (
    <MainLayout showSidebar={false}>
      <div className="py-6 space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            {t("search.title")}
          </h1>
          {query && (
            <p className="text-sm text-foreground-subtle">
              {t("search.results", { query })}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("posts")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "posts"
                ? "text-[#c9a84c] border-[#c9a84c]"
                : "text-foreground-subtle border-transparent hover:text-foreground-muted"
            }`}
          >
            {t("search.memes")} {postCount > 0 && <span className="ml-1 text-xs opacity-70">({postCount})</span>}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "users"
                ? "text-[#c9a84c] border-[#c9a84c]"
                : "text-foreground-subtle border-transparent hover:text-foreground-muted"
            }`}
          >
            {t("search.users")} {userCount > 0 && <span className="ml-1 text-xs opacity-70">({userCount})</span>}
          </button>
        </div>

        {/* Results */}
        {error ? (
          <ErrorState message="Search failed" onRetry={() => doSearch(query)} />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !query ? (
          <div className="py-12 space-y-6">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto text-foreground-subtle mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm text-foreground-subtle">
                {t("search.placeholder")}
              </p>
            </div>
            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div className="max-w-sm mx-auto">
                <h3 className="text-xs font-medium text-foreground-subtle mb-2 uppercase tracking-wider">{t("search.recentSearches")}</h3>
                <div className="space-y-1">
                  {recentSearches.map((q) => (
                    <div key={q} className="flex items-center gap-2 group">
                      <Link
                        href={`/search?q=${encodeURIComponent(q)}`}
                        className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
                      >
                        <svg className="w-3.5 h-3.5 text-foreground-subtle shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="truncate">{q}</span>
                      </Link>
                      <button
                        onClick={() => {
                          removeRecentSearch(q);
                          setRecentSearches(getRecentSearches());
                        }}
                        className="p-1 rounded text-foreground-subtle hover:text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "posts" ? (
          posts.length === 0 ? (
            <NoResultsMessage query={query} />
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <Link key={post.id} href={`/post/${post.id}`} className="block">
                  <Card hoverable>
                    <div className="flex gap-4">
                      {post.images?.[0]?.originalUrl && (
                        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-background-elevated">
                          <img
                            src={post.images[0].originalUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1">
                          {post.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-foreground-subtle">
                          <span>
                            {post.author.displayName || post.author.username}
                          </span>
                          {post.country && (
                            <span>{post.country.flagEmoji}</span>
                          )}
                          <span>&middot;</span>
                          <span>
                            {post.reactionCount} {t("search.reactions")}
                          </span>
                          <span>&middot;</span>
                          <span>
                            {post.commentCount} {t("search.comments")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )
        ) : users.length === 0 ? (
          <NoResultsMessage query={query} />
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <Link key={user.id} href={`/user/${user.username}`} className="block">
                <Card hoverable>
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.avatarUrl}
                      alt={user.displayName || user.username}
                      size="lg"
                      countryFlag={user.country?.flagEmoji}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {user.displayName || user.username}
                        </span>
                        {user.country && (
                          <span className="text-xs text-foreground-subtle">
                            {user.country.nameEn}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-foreground-subtle">
                        @{user.username}
                      </span>
                      {user.bio && (
                        <p className="text-xs text-foreground-muted mt-1 line-clamp-1">
                          {user.bio}
                        </p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-foreground-subtle">
                        <span>{user._count?.posts ?? 0} {t("search.posts")}</span>
                        <span>{user._count?.followers ?? 0} {t("search.followers")}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function NoResultsMessage({ query }: { query: string }) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-12 space-y-4">
      <svg className="w-16 h-16 mx-auto text-foreground-subtle opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p className="text-sm font-medium text-foreground-muted">
          {t("search.noResultsTitle", { query })}
        </p>
        <p className="text-xs text-foreground-subtle mt-2">
          {t("search.noResultsHint")}
        </p>
      </div>
      <div className="max-w-xs mx-auto text-left bg-background-surface border border-border rounded-lg p-3">
        <p className="text-[11px] font-medium text-foreground-subtle mb-1.5 uppercase tracking-wider">{t("search.suggestions")}</p>
        <ul className="text-xs text-foreground-muted space-y-1">
          <li>- {t("search.suggestionBroader")}</li>
          <li>- {t("search.suggestionTags")}</li>
          <li>- {t("search.suggestionUsername")}</li>
        </ul>
      </div>
    </div>
  );
}
