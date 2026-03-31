"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import MainLayout from "@/components/layout/MainLayout";
import FeedList from "@/components/feed/FeedList";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";
import Avatar from "@/components/ui/Avatar";

interface HotPost {
  id: string;
  title: string;
  body?: string | null;
  reactionCount: number;
  commentCount: number;
  createdAt: string;
  author: { username: string; displayName?: string | null; avatarUrl?: string | null };
  country?: { flagEmoji: string; nameEn: string } | null;
  images?: Array<{ originalUrl: string }>;
}

export default function CommunityPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();

  // User state
  const [freshLang, setFreshLang] = useState<string | null>(null);
  const [userCountryId, setUserCountryId] = useState<string | null>(null);
  const [userCountryFlag, setUserCountryFlag] = useState<string | null>(null);

  // Composer state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hot posts
  const [hotPosts, setHotPosts] = useState<HotPost[]>([]);
  const [showHot, setShowHot] = useState(false);

  // Filters
  const [sort, setSort] = useState("recent");
  const [countryFilter, setCountryFilter] = useState("");
  const [feedKey, setFeedKey] = useState(0); // Force FeedList re-render

  // Get user language
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("mimzy_preferredLanguage");
      if (stored) setFreshLang(stored);
    }
  }, []);

  // Get user's country
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/users/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.countryId) {
          setUserCountryId(data.countryId);
          setUserCountryFlag(data.country?.flagEmoji || null);
        }
        if (data?.preferredLanguage) {
          setFreshLang(data.preferredLanguage);
          localStorage.setItem("mimzy_preferredLanguage", data.preferredLanguage);
        }
      })
      .catch(() => {});
  }, [session?.user]);

  // Fetch hot posts
  useEffect(() => {
    fetch("/api/posts?category=community&sort=top&limit=10")
      .then((r) => r.json())
      .then((data) => {
        const posts = (data.posts || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          body: p.body,
          reactionCount: p.reactionCount ?? p._count?.reactions ?? 0,
          commentCount: p.commentCount ?? p._count?.comments ?? 0,
          createdAt: p.createdAt,
          author: p.author,
          country: p.country,
          images: p.images,
        }));
        setHotPosts(posts);
      })
      .catch(() => {});
  }, []);

  const translateTo = freshLang || session?.user?.preferredLanguage || "";

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Max file size is 10MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Upload image then create post
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    try {
      let uploadedImageUrl: string | null = null;
      let imgWidth: number | null = null;
      let imgHeight: number | null = null;
      let imgMime: string | null = null;

      // Upload image if selected
      if (imageFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", imageFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          uploadedImageUrl = uploadData.url;
          imgWidth = uploadData.width || null;
          imgHeight = uploadData.height || null;
          imgMime = uploadData.mimeType || null;
        }
        setUploading(false);
      }

      // Detect source language (default to user's preferred or "en")
      const sourceLang = freshLang || "en";

      // Create post via existing API
      const postData: any = {
        title: title.trim(),
        body: body.trim() || null,
        category: "community",
        sourceLanguage: sourceLang,
      };
      if (uploadedImageUrl) {
        postData.images = [{
          url: uploadedImageUrl,
          width: imgWidth,
          height: imgHeight,
          mimeType: imgMime,
        }];
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      const data = await res.json();

      if (data.id || data.post) {
        // Success - reset form and refresh feed
        setTitle("");
        setBody("");
        removeImage();
        setFeedKey((k) => k + 1);
      } else {
        alert(data.error || "Failed to create post");
      }
    } catch (err) {
      console.error("Post creation error:", err);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 py-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">{t("community.title")}</h1>
          <p className="text-sm text-foreground-subtle">{t("community.subtitle")}</p>
        </div>

        {/* Hot Posts Toggle */}
        {hotPosts.length > 0 && (
          <div className="bg-background-surface border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowHot(!showHot)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-background-elevated/50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span>🔥</span>
                {t("community.hotPosts")}
                <span className="text-xs font-normal text-foreground-subtle">({hotPosts.length})</span>
              </span>
              <svg
                className={`w-4 h-4 text-foreground-subtle transition-transform duration-200 ${showHot ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showHot && (
              <div className="px-4 pb-3 border-t border-border space-y-2 pt-3">
                {hotPosts.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/post/${p.id}`}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-background-elevated transition-colors"
                  >
                    <span className="text-xs font-bold text-[#c9a84c] mt-0.5 w-5 text-right shrink-0">
                      {i + 1}
                    </span>
                    {p.images?.[0]?.originalUrl && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-background-elevated">
                        <Image src={p.images[0].originalUrl} alt="" width={40} height={40} className="object-cover w-full h-full" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-foreground-subtle mt-0.5">
                        {p.country && <span>{p.country.flagEmoji}</span>}
                        <span>@{p.author.username}</span>
                        <span>·</span>
                        <span>🔥 {p.reactionCount}</span>
                        <span>💬 {p.commentCount}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Post Composer */}
        {session?.user ? (
          <form onSubmit={handleSubmit} className="bg-background-surface border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Avatar
                src={session.user.image || session.user.avatarUrl || null}
                alt={session.user.name || ""}
                size="sm"
              />
              <div className="flex-1 space-y-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("community.titlePlaceholder")}
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background-elevated text-sm font-medium focus:outline-none focus:border-[#c9a84c]/50 placeholder-foreground-subtle"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("community.bodyPlaceholder")}
                  rows={2}
                  maxLength={5000}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background-elevated text-sm resize-none focus:outline-none focus:border-[#c9a84c]/50 placeholder-foreground-subtle"
                />

                {/* Image preview */}
                {imagePreview && (
                  <div className="relative inline-block">
                    <Image src={imagePreview} alt="" width={160} height={120} className="rounded-lg object-cover max-h-32" />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Actions row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Image attach button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated border border-border transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                      {t("community.attachImage")}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    {userCountryFlag && (
                      <span className="text-[10px] text-foreground-subtle flex items-center gap-1">
                        {userCountryFlag} {t("community.postingAs")}
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!title.trim() || submitting}
                    className="px-4 py-1.5 rounded-lg bg-[#c9a84c] text-black text-xs font-medium disabled:opacity-40 hover:bg-[#b8963f] transition-colors"
                  >
                    {uploading ? t("community.uploading") : submitting ? t("common.loading") : t("community.post")}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="bg-background-surface border border-border rounded-xl p-4 text-center">
            <p className="text-sm text-foreground-subtle">{t("community.loginToPost")}</p>
            <Link href="/login" className="text-xs text-[#c9a84c] hover:underline mt-1 inline-block">
              {t("nav.login")} →
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort */}
          <div className="flex items-center gap-0.5 bg-background-surface rounded-lg p-0.5 border border-border">
            {[
              { value: "recent", label: t("filter.recent") },
              { value: "trending", label: t("filter.trending") },
              { value: "top", label: t("filter.top") },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSort(opt.value); setFeedKey((k) => k + 1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  sort === opt.value
                    ? "bg-background-overlay text-foreground"
                    : "text-foreground-subtle hover:text-foreground-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Country filter */}
          <select
            value={countryFilter}
            onChange={(e) => { setCountryFilter(e.target.value); setFeedKey((k) => k + 1); }}
            className="bg-background-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground-muted appearance-none cursor-pointer hover:border-border-active focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
          >
            <option value="">{t("filter.allCountries")}</option>
            <option value="KR">🇰🇷 {t("filter.korea")}</option>
            <option value="US">🇺🇸 {t("filter.usa")}</option>
            <option value="JP">🇯🇵 {t("filter.japan")}</option>
            <option value="CN">🇨🇳 {t("filter.china")}</option>
            <option value="MX">🇲🇽 {t("filter.mexico")}</option>
            <option value="GB">🇬🇧 UK</option>
            <option value="IN">🇮🇳 India</option>
            <option value="ES">🇪🇸 Spain</option>
          </select>

          {/* My Country quick filter */}
          {userCountryId && (
            <button
              onClick={() => {
                setCountryFilter(countryFilter === userCountryId ? "" : userCountryId);
                setFeedKey((k) => k + 1);
              }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                countryFilter === userCountryId
                  ? "border-[#c9a84c] bg-[#c9a84c]/15 text-[#c9a84c]"
                  : "border-[#c9a84c]/30 text-[#c9a84c]/70 hover:border-[#c9a84c] hover:text-[#c9a84c]"
              }`}
            >
              {userCountryFlag} {t("filter.myCountry")}
            </button>
          )}
        </div>

        {/* Feed */}
        <FeedList
          key={feedKey}
          translateTo={translateTo}
          filters={{ postType: "community", sort, country: countryFilter || undefined }}
          emptyMessage={t("community.emptyDiscussion")}
          emptySubtext={t("community.emptyDiscussionSubtext")}
          emptyActionLabel={t("community.startDiscussion")}
          emptyActionHref="/community"
          emptyIcon="💬"
        />
      </div>
    </MainLayout>
  );
}
