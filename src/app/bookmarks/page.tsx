"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import FeedCard from "@/components/feed/FeedCard";
import Link from "next/link";

interface BookmarkedPost {
  id: string;
  title: string;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  country?: {
    flagEmoji: string;
    nameEn: string;
  } | null;
  imageUrl: string;
  cleanImageUrl?: string;
  translatedImageUrl?: string;
  segments: any[];
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  tags?: string[];
}

const BATCH_SIZE = 10;

function getBookmarkIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("mimzy_bookmarks");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function mapPost(post: any): BookmarkedPost {
  const image = post.images?.[0];
  const payload = post.translationPayloads?.[0];
  return {
    id: post.id,
    title: post.title,
    author: {
      username: post.author?.username || "unknown",
      displayName: post.author?.displayName,
      avatarUrl: post.author?.avatarUrl,
    },
    country: post.country
      ? { flagEmoji: post.country.flagEmoji, nameEn: post.country.nameEn }
      : null,
    imageUrl: image?.originalUrl || "",
    cleanImageUrl: image?.cleanUrl || undefined,
    translatedImageUrl: payload?.translatedImageUrl || undefined,
    mimeType: image?.mimeType || undefined,
    segments: (payload?.segments ?? []).map((s: any) => ({
      sourceText: s.sourceText ?? "",
      translatedText: s.translatedText ?? "",
      boxX: s.boxX,
      boxY: s.boxY,
      boxWidth: s.boxWidth,
      boxHeight: s.boxHeight,
    })),
    reactionCount: post._count?.reactions ?? post.reactionCount ?? 0,
    commentCount: post._count?.comments ?? post.commentCount ?? 0,
    shareCount: post.shareCount ?? 0,
    createdAt: post.createdAt,
    tags: post.tags || [],
  } as BookmarkedPost;
}

async function fetchBatch(ids: string[]): Promise<BookmarkedPost[]> {
  const results = await Promise.allSettled(
    ids.map((id) =>
      fetch(`/api/posts/${id}`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then(mapPost)
    )
  );
  return results
    .filter((r): r is PromiseFulfilledResult<BookmarkedPost> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((p) => p.imageUrl);
}

export default function BookmarksPage() {
  const { t } = useTranslation();
  const { status } = useSession();
  const [posts, setPosts] = useState<BookmarkedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const allIdsRef = useRef<string[]>([]);
  const loadedCountRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadBookmarks() {
      let ids: string[];

      if (status === "authenticated") {
        try {
          const res = await fetch("/api/bookmarks");
          if (res.ok) {
            const data = await res.json();
            ids = data.postIds ?? [];
          } else {
            ids = getBookmarkIds();
          }
        } catch {
          ids = getBookmarkIds();
        }
      } else {
        ids = getBookmarkIds();
      }

      allIdsRef.current = ids;
      loadedCountRef.current = 0;

      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      // Load first batch
      const firstBatch = ids.slice(0, BATCH_SIZE);
      const fetched = await fetchBatch(firstBatch);
      loadedCountRef.current = firstBatch.length;
      setPosts(fetched);
      setHasMore(loadedCountRef.current < ids.length);
      setLoading(false);
    }

    if (status !== "loading") {
      loadBookmarks();
    }
  }, [status]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const start = loadedCountRef.current;
    if (start >= allIdsRef.current.length) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextBatch = allIdsRef.current.slice(start, start + BATCH_SIZE);
    if (nextBatch.length === 0) {
      setHasMore(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }
    const fetched = await fetchBatch(nextBatch);
    loadedCountRef.current = start + nextBatch.length;
    setPosts((prev) => [...prev, ...fetched]);
    const moreAvailable = loadedCountRef.current < allIdsRef.current.length;
    setHasMore(moreAvailable);
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, []);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <MainLayout showSidebar={false}>
      <div className="py-6 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">{t("bookmarks.title")}</h1>
          <p className="text-sm text-foreground-subtle">{t("bookmarks.subtitle")}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <svg
              className="w-16 h-16 text-foreground-subtle"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            <p className="text-foreground-subtle text-sm">{t("bookmarks.empty")}</p>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#c9a84c] text-black hover:bg-[#b8963f] transition-colors"
            >
              {t("bookmarks.explore")}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <FeedCard
                key={post.id}
                id={post.id}
                title={post.title}
                author={post.author}
                country={post.country}
                imageUrl={post.imageUrl}
                cleanImageUrl={post.cleanImageUrl}
                translatedImageUrl={post.translatedImageUrl}
                segments={post.segments}
                reactionCount={post.reactionCount}
                commentCount={post.commentCount}
                shareCount={post.shareCount}
                createdAt={post.createdAt}
                tags={post.tags}
                onDelete={(deletedId) => setPosts((prev) => prev.filter((p) => p.id !== deletedId))}
              />
            ))}
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
