"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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

function getBookmarkIds(): string[] {
  try {
    const raw = localStorage.getItem("lolympic_bookmarks");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function BookmarksPage() {
  const { status } = useSession();
  const [posts, setPosts] = useState<BookmarkedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = getBookmarkIds();
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch each bookmarked post
    Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/posts/${id}`)
          .then((r) => {
            if (!r.ok) throw new Error();
            return r.json();
          })
          .then((post) => {
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
          })
      )
    ).then((results) => {
      const successPosts = results
        .filter((r): r is PromiseFulfilledResult<BookmarkedPost> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((p) => p.imageUrl);
      setPosts(successPosts);
      setLoading(false);
    });
  }, []);

  return (
    <MainLayout showSidebar={false}>
      <div className="py-6 space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Bookmarks</h1>
          <p className="text-sm text-foreground-subtle">Your saved memes</p>
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
            <p className="text-foreground-subtle text-sm">No bookmarks yet</p>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#c9a84c] text-black hover:bg-[#b8963f] transition-colors"
            >
              Explore Memes
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
          </div>
        )}
      </div>
    </MainLayout>
  );
}
