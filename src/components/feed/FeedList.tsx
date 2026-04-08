"use client";

import React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import FeedCard from "./FeedCard";
import CountryRaceWidget from "./CountryRaceWidget";
import BattleCard from "@/components/battle/BattleCard";
import AdSlot from "@/components/ads/AdSlot";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { TranslationSegmentData } from "@/types/components";
import { useTranslation } from "@/i18n";

/** Show an ad slot after every N-th feed item. Adjust this to change ad frequency. */
const AD_SLOT_INTERVAL = 5;

interface TopComment {
  id: string;
  body: string;
  likeCount: number;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    isChampion?: boolean;
    countryFlag?: string;
  };
}

interface FeedImage {
  originalUrl: string;
  cleanUrl?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
}

interface FeedPost {
  id: string;
  title: string;
  body?: string | null;
  category?: string | null;
  translatedTitle?: string;
  translatedBody?: string;
  sourceLanguage?: string;
  memeType?: string;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    isChampion?: boolean;
  };
  country?: {
    flagEmoji: string;
    nameEn: string;
  } | null;
  imageUrl: string;
  cleanImageUrl?: string;
  translatedImageUrl?: string;
  translatedImageUrls?: string[];
  mimeType?: string;
  segments: TranslationSegmentData[];
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  createdAt: string;
  seasonBadge?: string;
  tags?: string[];
  topComments?: TopComment[];
  images?: FeedImage[];
}

interface FeedListProps {
  translateTo?: string;
  emptyMessage?: string;
  emptySubtext?: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
  emptyActionClick?: () => void;
  emptyIcon?: string;
  filters?: {
    country?: string;
    language?: string;
    category?: string;
    postType?: string;
    sort?: string;
    search?: string;
    tag?: string;
  };
}

function mapApiPost(post: any): FeedPost {
  const image = post.images?.[0];
  const payload = post.translationPayloads?.[0];
  const segments: TranslationSegmentData[] = (payload?.segments ?? []).map(
    (s: any) => ({
      id: s.id ?? "",
      imageIndex: s.imageIndex ?? 0,
      sourceText: s.sourceText ?? "",
      translatedText: s.translatedText ?? "",
      semanticRole: s.semanticRole ?? "",
      boxX: s.boxX ?? null,
      boxY: s.boxY ?? null,
      boxWidth: s.boxWidth ?? null,
      boxHeight: s.boxHeight ?? null,
      fontFamily: s.fontFamily ?? undefined,
      fontWeight: s.fontWeight ?? undefined,
      fontSizePixels: s.fontSizePixels ?? undefined,
      color: s.color ?? undefined,
      textAlign: s.textAlign ?? undefined,
      rotation: s.rotation ?? undefined,
      isUppercase: s.isUppercase ?? undefined,
      strokeColor: s.strokeColor ?? undefined,
      strokeWidth: s.strokeWidth ?? undefined,
      shadowColor: s.shadowColor ?? undefined,
      shadowOffsetX: s.shadowOffsetX ?? undefined,
      shadowOffsetY: s.shadowOffsetY ?? undefined,
      shadowBlur: s.shadowBlur ?? undefined,
      fontHint: s.fontHint ?? undefined,
    })
  );

  return {
    id: post.id,
    title: post.title,
    body: post.body || null,
    category: post.category || null,
    translatedTitle: payload?.translatedTitle || undefined,
    translatedBody: payload?.translatedBody || undefined,
    sourceLanguage: post.sourceLanguage || undefined,
    memeType: payload?.memeType || undefined,
    author: {
      username: post.author?.username || "unknown",
      displayName: post.author?.displayName,
      avatarUrl: post.author?.avatarUrl,
      isChampion: post.author?.isChampion || false,
    },
    country: post.country
      ? { flagEmoji: post.country.flagEmoji, nameEn: post.country.nameEn }
      : null,
    imageUrl: image?.originalUrl || "",
    cleanImageUrl: image?.cleanUrl || undefined,
    translatedImageUrl: payload?.translatedImageUrl?.startsWith("http") ? payload.translatedImageUrl : undefined,
    translatedImageUrls: Array.isArray(payload?.translatedImageUrls) ? payload.translatedImageUrls as string[] : undefined,
    mimeType: image?.mimeType || undefined,
    segments,
    reactionCount: post.reactionCount ?? post._count?.reactions ?? 0,
    commentCount: post.commentCount ?? post._count?.comments ?? 0,
    shareCount: post.shareCount ?? 0,
    viewCount: post.viewCount ?? 0,
    createdAt: String(post.createdAt || ""),
    tags: post.tags || [],
    images: (post.images || []).map((img: any) => ({
      originalUrl: img.originalUrl,
      cleanUrl: img.cleanUrl || null,
      mimeType: img.mimeType || null,
      width: img.width ?? null,
      height: img.height ?? null,
    })),
    topComments: (post.comments || []).map((c: any) => ({
      id: c.id,
      body: c.body,
      likeCount: c.likeCount ?? 0,
      author: {
        username: c.author?.username || "unknown",
        displayName: c.author?.displayName,
        avatarUrl: c.author?.avatarUrl,
        isChampion: c.author?.isChampion || false,
        countryFlag: c.author?.country?.flagEmoji,
      },
    })),
  };
}

export default function FeedList({
  translateTo = "",
  emptyMessage,
  emptySubtext,
  emptyActionLabel,
  emptyActionHref,
  emptyActionClick,
  emptyIcon,
  filters,
}: FeedListProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const resolvedEmptyMessage = emptyMessage || t("feed.empty");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [battleDismissed, setBattleDismissed] = useState(false);
  const BATTLE_FIRST = 7; // Show first battle after 7 posts (below country competition)
  const BATTLE_INTERVAL = 10; // Then every 10 posts after that
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const filtersJson = JSON.stringify(filters);

  // Batch-fetch bookmarked post IDs once on mount
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/bookmarks?limit=200")
      .then((r) => r.ok ? r.json() : { bookmarks: [] })
      .then((data) => {
        const ids = new Set<string>((data.bookmarks || data.postIds || []).map((b: any) => typeof b === "string" ? b : b.postId));
        setBookmarkedIds(ids);
      })
      .catch(() => {});
  }, [session?.user]);

  const fetchPosts = useCallback(async (page: number, lang: string, signal?: AbortSignal) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);

    const parsedFilters = filtersJson ? JSON.parse(filtersJson) : undefined;

    setFetchError(false);

    try {
      const isFollowingFeed = parsedFilters?.sort === "following";
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sort: isFollowingFeed ? "recent" : (parsedFilters?.sort || "trending"),
      });
      if (isFollowingFeed) params.set("feed", "following");
      if (lang) params.set("translateTo", lang);
      if (parsedFilters?.postType) params.set("category", parsedFilters.postType);
      else if (parsedFilters?.category) params.set("category", parsedFilters.category);
      // Exclude community posts from main feed when no specific category/postType is set
      if (!parsedFilters?.postType && !parsedFilters?.category) {
        params.set("excludeCategory", "community");
      }
      if (parsedFilters?.country && !isFollowingFeed) params.set("country", parsedFilters.country);
      if (parsedFilters?.language) params.set("language", parsedFilters.language);
      if (parsedFilters?.search) params.set("search", parsedFilters.search);
      if (parsedFilters?.tag) params.set("tag", parsedFilters.tag);

      const res = await fetch(`/api/posts?${params}`, { signal });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const mapped = (data.posts || []).map(mapApiPost);

      setPosts((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
      setHasMore(page < (data.pagination?.totalPages ?? 1));
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Feed fetch error:", err);
      setFetchError(true);
      setHasMore(false);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [filtersJson]);

  // Reload when translateTo or filters change
  useEffect(() => {
    pageRef.current = 1;
    setPosts([]);
    setHasMore(true);

    const controller = new AbortController();
    abortRef.current = controller;
    fetchPosts(1, translateTo, controller.signal);

    return () => {
      controller.abort();
      fetchingRef.current = false;
    };
  }, [translateTo, fetchPosts, filtersJson]);

  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore) return;
    pageRef.current += 1;
    fetchPosts(pageRef.current, translateTo);
  }, [hasMore, fetchPosts, translateTo]);

  // Stable ref so callbacks always use latest loadMore
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; }, [loadMore]);

  // Infinite scroll — IntersectionObserver + scroll fallback
  // Re-creates observer whenever posts change (sentinel may move in DOM)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "600px" }
    );
    observer.observe(sentinel);

    // Scroll-based fallback — catches cases where observer misses
    const onScroll = () => {
      if (!sentinelRef.current) return;
      const rect = sentinelRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight + 600) {
        loadMoreRef.current();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [posts.length]); // re-attach when posts change

  // After fetch completes, check if sentinel is still visible (short page / few posts)
  useEffect(() => {
    if (loading || !hasMore || fetchingRef.current) return;
    // Small delay to let DOM settle after render
    const timer = setTimeout(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const rect = sentinel.getBoundingClientRect();
      if (rect.top < window.innerHeight + 600) {
        loadMore();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, hasMore, loadMore]);

  // Error state with retry
  if (fetchError && posts.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-2">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-sm text-foreground-subtle">{t("feed.fetchError") || "Failed to load posts."}</p>
        <button
          onClick={() => {
            pageRef.current = 1;
            setPosts([]);
            setHasMore(true);
            setFetchError(false);
            fetchPosts(1, translateTo);
          }}
          className="px-4 py-2 rounded-lg bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#d4b85e] transition-colors"
        >
          {t("common.retry") || "Try again"}
        </button>
      </div>
    );
  }

  // Empty state
  if (posts.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        {emptyIcon ? <span className="text-5xl mb-4">{emptyIcon}</span> : <span className="text-5xl mb-4 text-foreground-subtle">&#8212;</span>}
        <h3 className="text-lg font-bold text-foreground mb-2">{resolvedEmptyMessage}</h3>
        <p className="text-sm text-foreground-subtle mb-6 max-w-sm">
          {emptySubtext || "Be the first to share a meme and get it translated into 7 languages!"}
        </p>
        {emptyActionClick ? (
          <button
            onClick={emptyActionClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c9a84c] hover:bg-[#d4b65c] text-black font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {emptyActionLabel || "Upload a Meme"}
          </button>
        ) : (
          <a
            href={emptyActionHref || "/upload"}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c9a84c] hover:bg-[#d4b65c] text-black font-medium text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {emptyActionLabel || "Upload a Meme"}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post, index) => (
        <React.Fragment key={post.id}>
          <div className="animate-fade-in-up" style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}>
          <FeedCard
            {...post}
            isBookmarked={bookmarkedIds.has(post.id)}
            onDelete={(deletedId) => setPosts((prev) => prev.filter((p) => p.id !== deletedId))}
          />
          </div>
          {/* Country Race Widget after 2nd post */}
          {index === 1 && <CountryRaceWidget />}
          {/* Ad slot insertion at configurable intervals */}
          {(index + 1) % AD_SLOT_INTERVAL === 0 && (
            <AdSlot slot={`feed-${Math.floor((index + 1) / AD_SLOT_INTERVAL)}`} />
          )}
          {/* Battle cards only between meme/image posts, not text posts */}
          {!battleDismissed && post.imageUrl && (
            index + 1 === BATTLE_FIRST ||
            (index + 1 > BATTLE_FIRST && (index + 1 - BATTLE_FIRST) % BATTLE_INTERVAL === 0)
          ) && (
            <BattleCard onDismiss={() => setBattleDismissed(true)} />
          )}
        </React.Fragment>
      ))}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {/* Infinite scroll sentinel — always mounted so the observer can attach */}
      <div ref={sentinelRef} className="h-1" />

      {/* End of feed */}
      {!hasMore && posts.length > 0 && (
        <p className="text-center text-xs text-foreground-subtle py-8">
          {t("feed.endOfFeed")}
        </p>
      )}
    </div>
  );
}
