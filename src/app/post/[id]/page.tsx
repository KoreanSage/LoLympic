"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import MainLayout from "@/components/layout/MainLayout";
import PostDetail from "@/components/post/PostDetail";
import { useTranslation } from "@/i18n";

export default function PostPage() {
  const params = useParams();
  const { data: session } = useSession();
  const id = params.id as string;
  const { t } = useTranslation();
  const [post, setPost] = useState<any>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [freshLang, setFreshLang] = useState<string | null>(null);
  const [clientTranslatedTitle, setClientTranslatedTitle] = useState<string | null>(null);
  const [clientTranslatedBody, setClientTranslatedBody] = useState<string | null>(null);
  const titleBackfillAttempted = useRef(false);

  // Get the user's ACTUAL preferredLanguage: localStorage (instant) > DB > session JWT
  useEffect(() => {
    const stored = localStorage.getItem("lolympic_preferredLanguage");
    if (stored) {
      setFreshLang(stored);
    }
    if (!session?.user) return;
    fetch("/api/users/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.preferredLanguage) {
          setFreshLang(data.preferredLanguage);
          localStorage.setItem("lolympic_preferredLanguage", data.preferredLanguage);
        }
      })
      .catch(() => {});
  }, [session?.user]);

  // Use fresh value > session value > default
  const preferredLang = freshLang || (session?.user as any)?.preferredLanguage || "en";

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    setLoading(true);
    setError(false);
    setClientTranslatedTitle(null);
    setClientTranslatedBody(null);
    titleBackfillAttempted.current = false;

    fetch(`/api/posts/${id}?lang=${preferredLang}`)
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
  }, [id, preferredLang]);

  // Client-side title/body translation: if payload has segments but no translatedTitle,
  // call a lightweight endpoint to translate it
  useEffect(() => {
    if (!post || titleBackfillAttempted.current) return;
    const payload = post.translationPayloads?.[0];
    // Need at least segments to know this is a translated post
    if (!payload?.segments?.length) return;
    // Skip if title is already translated
    if (payload.translatedTitle) return;
    // Skip if no title to translate, or same language
    if (!post.title || post.sourceLanguage === preferredLang) return;

    titleBackfillAttempted.current = true;

    fetch("/api/translate/title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: post.title,
        body: post.body || null,
        targetLanguage: preferredLang,
        payloadId: payload.id,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data?.translatedTitle) {
          setClientTranslatedTitle(data.translatedTitle);
        }
        if (data?.translatedBody) {
          setClientTranslatedBody(data.translatedBody);
        }
      })
      .catch((err) => {
        console.warn("Client-side title translation failed:", err);
      });
  }, [post, preferredLang]);

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
          <p className="text-foreground-subtle text-sm">{t("postDetail.notFound")}</p>
        </div>
      </MainLayout>
    );
  }

  // Map API response to PostDetail props
  const image = post.images?.[0];
  const payload = post.translationPayloads?.[0];
  const translatedTitle = clientTranslatedTitle || payload?.translatedTitle || null;
  const translatedBody = clientTranslatedBody || payload?.translatedBody || null;

  const segments = (payload?.segments ?? []).map((s: any) => ({
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
        title={translatedTitle || post.title}
        originalTitle={translatedTitle ? post.title : undefined}
        body={translatedBody || post.body}
        originalBody={translatedBody ? post.body : undefined}
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
        images={(post.images || []).map((img: any) => ({
          originalUrl: img.originalUrl,
          cleanUrl: img.cleanUrl || null,
          mimeType: img.mimeType || null,
        }))}
        cultureNotes={cultureNotes}
        suggestions={[]}
        comments={[]}
      />
    </MainLayout>
  );
}
