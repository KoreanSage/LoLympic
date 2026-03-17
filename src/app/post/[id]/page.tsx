"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import PostDetail from "@/components/post/PostDetail";

export default function PostPage() {
  const params = useParams();
  const id = params.id as string;
  const [post, setPost] = useState<any>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/posts/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPost(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <MainLayout showSidebar={false}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (error || !post) {
    return (
      <MainLayout showSidebar={false}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-foreground-subtle text-sm">Post not found</p>
        </div>
      </MainLayout>
    );
  }

  // Map API response to PostDetail props
  const image = post.images?.[0];
  const payload = post.translationPayloads?.[0];
  const segments = (payload?.segments ?? []).map((s: any) => ({
    id: s.id ?? "",
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
  }));

  const cultureNotes = (post.cultureNotes ?? []).map((n: any) => ({
    id: n.id,
    summary: n.summary,
    explanation: n.explanation,
    translationNote: n.translationNote,
    creatorType: n.creatorType,
    status: n.status,
  }));

  return (
    <MainLayout showSidebar={false}>
      <PostDetail
        id={post.id}
        title={post.title}
        body={post.body}
        author={{
          username: post.author?.username || "unknown",
          displayName: post.author?.displayName,
          avatarUrl: post.author?.avatarUrl,
          isChampion: post.author?.isChampion || false,
        }}
        country={
          post.country
            ? { flagEmoji: post.country.flagEmoji, nameEn: post.country.nameEn }
            : null
        }
        imageUrl={image?.originalUrl || ""}
        cleanImageUrl={image?.cleanUrl || undefined}
        translatedImageUrl={payload?.translatedImageUrl || undefined}
        mimeType={image?.mimeType || undefined}
        segments={segments}
        reactionCount={post._count?.reactions ?? 0}
        commentCount={post._count?.comments ?? 0}
        shareCount={post.shareCount ?? 0}
        viewCount={post.viewCount ?? 0}
        createdAt={post.createdAt}
        tags={post.tags || []}
        cultureNotes={cultureNotes}
        suggestions={[]}
        comments={[]}
      />
    </MainLayout>
  );
}
