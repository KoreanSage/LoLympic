"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";

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

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
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
    } catch {
      // ignore
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
            Memes {postCount > 0 && <span className="ml-1 text-xs opacity-70">({postCount})</span>}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "users"
                ? "text-[#c9a84c] border-[#c9a84c]"
                : "text-foreground-subtle border-transparent hover:text-foreground-muted"
            }`}
          >
            Users {userCount > 0 && <span className="ml-1 text-xs opacity-70">({userCount})</span>}
          </button>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !query ? (
          <p className="text-sm text-foreground-subtle text-center py-12">
            {t("search.placeholder")}
          </p>
        ) : activeTab === "posts" ? (
          posts.length === 0 ? (
            <p className="text-sm text-foreground-subtle text-center py-12">
              {t("search.noResults", { query })}
            </p>
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
                            {post.reactionCount} reactions
                          </span>
                          <span>&middot;</span>
                          <span>
                            {post.commentCount} comments
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
          <p className="text-sm text-foreground-subtle text-center py-12">
            {t("search.noResults", { query })}
          </p>
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
                        <span>{user._count?.posts ?? 0} posts</span>
                        <span>{user._count?.followers ?? 0} followers</span>
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
