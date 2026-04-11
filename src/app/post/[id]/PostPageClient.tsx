"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import MainLayout from "@/components/layout/MainLayout";
import PostDetail from "@/components/post/PostDetail";
import { useTranslation } from "@/i18n";

export default function PostPageClient() {
  const params = useParams();
  const { data: session } = useSession();
  const id = params.id as string;
  const { t } = useTranslation();
  const [post, setPost] = useState<any>(null);
  const [error, setError] = useState<false | "not-found" | "timeout" | "error">(false);
  const [loading, setLoading] = useState(true);
  const [clientTranslatedTitle, setClientTranslatedTitle] = useState<string | null>(null);
  const [clientTranslatedBody, setClientTranslatedBody] = useState<string | null>(null);
  const titleBackfillAttempted = useRef(false);
  const cleanImageAttempted = useRef(false);
  const translationRetryAttempted = useRef(false);

  // Resolve preferredLanguage: localStorage (instant) > DB > session JWT
  // Use a synchronous initial value from localStorage to avoid double-fetch
  const [preferredLang, setPreferredLang] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("mimzy_preferredLanguage");
      if (stored) return stored;
    }
    return session?.user?.preferredLanguage || "en";
  });
  const [langReady, setLangReady] = useState(() => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("mimzy_preferredLanguage");
    }
    return false;
  });

  // Verify from DB for accuracy (only updates if different)
  useEffect(() => {
    if (!session?.user) {
      setLangReady(true);
      return;
    }
    fetch("/api/users/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.preferredLanguage) {
          setPreferredLang(data.preferredLanguage);
          localStorage.setItem("mimzy_preferredLanguage", data.preferredLanguage);
        }
      })
      .catch((e) => { console.error("Failed to fetch user language preference:", e); })
      .finally(() => setLangReady(true));
  }, [session?.user?.preferredLanguage]);

  useEffect(() => {
    if (!id || !langReady) return;

    let cancelled = false;
    setLoading(true);
    setError(false);
    setClientTranslatedTitle(null);
    setClientTranslatedBody(null);
    titleBackfillAttempted.current = false;
    cleanImageAttempted.current = false;
    translationRetryAttempted.current = false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch(`/api/posts/${id}?lang=${preferredLang}`, { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeoutId);
        if (res.status === 404) throw new Error("not-found");
        if (!res.ok) throw new Error("error");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPost(data);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (err?.name === "AbortError") {
          setError("timeout");
        } else if (err?.message === "not-found") {
          setError("not-found");
        } else {
          setError("error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, preferredLang, langReady]);

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

  // Auto-generate clean images if translation exists but no clean image
  useEffect(() => {
    if (!post || cleanImageAttempted.current) return;
    const payload = post.translationPayloads?.[0];
    if (!payload?.segments?.length) return;
    // Check if any image is missing cleanUrl OR if translated image is missing
    const hasImageWithoutClean = (post.images || []).some(
      (img: any) => !img.cleanUrl
    );
    const missingTranslatedImage = payload && !payload.translatedImageUrl;
    if (!hasImageWithoutClean && !missingTranslatedImage) return;

    cleanImageAttempted.current = true;
    fetch("/api/translate/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: post.id }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.images?.some((img: any) => img.cleanUrl) || data?.translatedImageUrl) {
          // Reload the post to get updated URLs
          fetch(`/api/posts/${id}?lang=${preferredLang}`)
            .then((r) => r.ok ? r.json() : null)
            .then((freshPost) => {
              if (freshPost) setPost(freshPost);
            })
            .catch((e) => { console.error("Failed to refresh post data:", e); });
        }
      })
      .catch((e) => { console.error("Failed to generate translated image:", e); });
  }, [post, id, preferredLang]);

  // Auto-retry translation if post has images but no translation payload for user's language
  // This handles cases where the initial upload translation failed silently
  useEffect(() => {
    if (!post || !session?.user || translationRetryAttempted.current) return;
    // Only for image posts
    if (!post.images?.length) return;
    // Already has translations
    if (post.translationPayloads?.length > 0) return;
    // Same language — no translation needed
    if (post.sourceLanguage === preferredLang) return;

    translationRetryAttempted.current = true;
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: post.id,
        sourceLanguage: post.sourceLanguage || "ko",
        targetLanguages: [preferredLang],
      }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.translations?.[preferredLang]?.payloadId) {
          // Reload post to pick up new translation
          fetch(`/api/posts/${id}?lang=${preferredLang}`)
            .then((r) => r.ok ? r.json() : null)
            .then((freshPost) => { if (freshPost) setPost(freshPost); })
            .catch(() => {});
        }
      })
      .catch((e) => { console.warn("Auto-retry translation failed:", e); });
  }, [post, session?.user, preferredLang, id]);

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
          {error === "timeout" ? (
            <>
              <p className="text-foreground-subtle text-sm">
                Loading took too long. Please check your connection and try again.
              </p>
              <button
                onClick={() => {
                  setError(false);
                  setLoading(true);
                  setPost(null);
                  const controller2 = new AbortController();
                  const timeout2 = setTimeout(() => controller2.abort(), 10000);
                  fetch(`/api/posts/${id}?lang=${preferredLang}`, { signal: controller2.signal })
                    .then((res) => {
                      clearTimeout(timeout2);
                      if (res.status === 404) throw new Error("not-found");
                      if (!res.ok) throw new Error("error");
                      return res.json();
                    })
                    .then((data) => setPost(data))
                    .catch((err) => {
                      clearTimeout(timeout2);
                      if (err?.name === "AbortError") setError("timeout");
                      else if (err?.message === "not-found") setError("not-found");
                      else setError("error");
                    })
                    .finally(() => setLoading(false));
                }}
                className="px-4 py-2 rounded-lg bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#d4b85e] transition-colors"
              >
                {t("common.retry") || "Try again"}
              </button>
            </>
          ) : error === "not-found" ? (
            <p className="text-foreground-subtle text-sm">{t("postDetail.notFound")}</p>
          ) : (
            <>
              <p className="text-foreground-subtle text-sm">
                {t("postDetail.loadError") || "Failed to load post."}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#d4b85e] transition-colors"
              >
                {t("common.retry") || "Try again"}
              </button>
            </>
          )}
        </div>
      </MainLayout>
    );
  }

  // Map API response to PostDetail props
  const image = post.images?.[0];
  const payload = post.translationPayloads?.[0];
  const translatedTitle = clientTranslatedTitle || payload?.translatedTitle || null;
  const translatedBody = clientTranslatedBody || payload?.translatedBody || null;
  // Don't show originalBody if it's the same as body (no actual translation)
  const effectiveTranslatedBody = translatedBody && translatedBody !== post.body ? translatedBody : null;

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

  // Filter culture notes to show only the user's preferred language
  const cultureNotes = (post.cultureNotes ?? [])
    .filter((n: any) => !preferredLang || n.language === preferredLang)
    .map((n: any) => ({
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
        body={effectiveTranslatedBody || post.body}
        originalBody={effectiveTranslatedBody ? post.body : undefined}
        author={{
          username: post.author?.username || "unknown",
          displayName: post.author?.displayName,
          avatarUrl: post.author?.avatarUrl,
          isChampion: post.author?.isChampion || false,
        }}
        category={post.category || null}
        country={
          post.country
            ? { flagEmoji: post.country.flagEmoji, nameEn: post.country.nameEn }
            : null
        }
        imageUrl={image?.originalUrl || ""}
        cleanImageUrl={image?.cleanUrl || undefined}
        translatedImageUrl={(post.images?.length ?? 0) > 1 ? undefined : (payload?.translatedImageUrl || undefined)}
        mimeType={image?.mimeType || undefined}
        segments={segments}
        memeType={payload?.memeType || undefined}
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
          width: img.width ?? null,
          height: img.height ?? null,
        }))}
        cultureNotes={cultureNotes}
        suggestions={[]}
        comments={[]}
        preferredLang={preferredLang}
      />
    </MainLayout>
  );
}
