"use client";

import React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import FeedCard from "./FeedCard";
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
  mimeType?: string;
  segments: TranslationSegmentData[];
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  seasonBadge?: string;
  tags?: string[];
  topComments?: TopComment[];
  images?: FeedImage[];
}

interface FeedListProps {
  translateTo?: string;
  emptyMessage?: string;
  filters?: {
    country?: string;
    language?: string;
    category?: string;
    postType?: string;
    sort?: string;
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
    translatedImageUrl: payload?.translatedImageUrl || undefined,
    mimeType: image?.mimeType || undefined,
    segments,
    reactionCount: post.reactionCount ?? post._count?.reactions ?? 0,
    commentCount: post.commentCount ?? post._count?.comments ?? 0,
    shareCount: post.shareCount ?? 0,
    createdAt: post.createdAt,
    tags: post.tags || [],
    images: (post.images || []).map((img: any) => ({
      originalUrl: img.originalUrl,
      cleanUrl: img.cleanUrl || null,
      mimeType: img.mimeType || null,
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
  filters,
}: FeedListProps) {
  const { t } = useTranslation();
  const resolvedEmptyMessage = emptyMessage || t("feed.empty");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [battleDismissed, setBattleDismissed] = useState(false);
  const BATTLE_FIRST = 3; // Show first battle after 3 posts
  const BATTLE_INTERVAL = 7; // Then every 7 posts after that
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const filtersJson = JSON.stringify(filters);

  const fetchPosts = useCallback(async (page: number, lang: string, signal?: AbortSignal) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);

    const parsedFilters = filtersJson ? JSON.parse(filtersJson) : undefined;

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sort: parsedFilters?.sort || "trending",
      });
      if (lang) params.set("translateTo", lang);
      if (parsedFilters?.postType) params.set("category", parsedFilters.postType);
      else if (parsedFilters?.category) params.set("category", parsedFilters.category);
      if (parsedFilters?.country) params.set("country", parsedFilters.country);
      if (parsedFilters?.language) params.set("language", parsedFilters.language);

      const res = await fetch(`/api/posts?${params}`, { signal });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const mapped = (data.posts || []).map(mapApiPost);

      setPosts((prev) => (page === 1 ? mapped : [...prev, ...mapped]));
      setHasMore(page < (data.pagination?.totalPages ?? 1));
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("Feed fetch error:", err);
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

  // Infinite scroll observer
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

  // Empty state
  if (posts.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-background-elevated rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-foreground-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm text-foreground-subtle">{resolvedEmptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post, index) => (
        <React.Fragment key={post.id}>
          <FeedCard
            {...post}
            onDelete={(deletedId) => setPosts((prev) => prev.filter((p) => p.id !== deletedId))}
          />
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

      {/* Infinite scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-1" />}

      {/* End of feed */}
      {!hasMore && posts.length > 0 && (
        <p className="text-center text-xs text-foreground-subtle py-8">
          {t("feed.endOfFeed")}
        </p>
      )}
    </div>
  );
}
