"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import MainLayout from "@/components/layout/MainLayout";
import FeedList from "@/components/feed/FeedList";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";

interface HotPost {
  id: string;
  title: string;
  translatedTitle?: string | null;
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

  // Write modal
  const [showWrite, setShowWrite] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [postCategory, setPostCategory] = useState("general");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hot posts (sidebar)
  const [hotPosts, setHotPosts] = useState<HotPost[]>([]);

  // Filters
  const [sort, setSort] = useState("recent");
  const [countryFilter, setCountryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [feedKey, setFeedKey] = useState(0);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const translateTo = freshLang || session?.user?.preferredLanguage || "";

  // Fetch hot posts (re-fetch when translateTo changes to get translated titles)
  useEffect(() => {
    const params = new URLSearchParams({ category: "community", sort: "top", limit: "10" });
    if (translateTo) params.set("translateTo", translateTo);
    fetch(`/api/posts?${params}`)
      .then((r) => r.ok ? r.json() : { posts: [] })
      .then((data) => {
        const posts = (data.posts || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          translatedTitle: p.translationPayloads?.[0]?.translatedTitle || null,
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
  }, [translateTo]);

  // Image handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Max 10MB"); return; }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit post
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      let uploadedImageUrl: string | null = null;
      let imgWidth: number | null = null;
      let imgHeight: number | null = null;
      let imgMime: string | null = null;

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

      const postData: any = {
        title: title.trim(),
        body: body.trim() || null,
        category: "community",
        tags: [postCategory],
        sourceLanguage: freshLang || "en",
      };
      if (uploadedImageUrl) {
        postData.images = [{ url: uploadedImageUrl, width: imgWidth, height: imgHeight, mimeType: imgMime }];
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postData),
      });
      const data = await res.json();

      const postId = data.post?.id || data.id;
      if (postId) {
        // Fire-and-forget: trigger text translation to all languages
        fetch("/api/translate/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId,
            sourceLanguage: freshLang || "en",
          }),
        }).catch(() => {});

        setTitle(""); setBody(""); setPostCategory("general"); removeImage();
        setShowWrite(false);
        setFeedKey((k) => k + 1);
      } else {
        alert(data.error || "Failed to create post");
      }
    } catch (err) {
      console.error("Post creation error:", err);
    } finally {
      setSubmitting(false); setUploading(false);
    }
  };

  // Close modal on escape
  useEffect(() => {
    if (!showWrite) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowWrite(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showWrite]);

  // ── Custom Sidebar ────────────────────────────────────────────────────────
  const communitySidebar = (
    <div className="space-y-4 sticky top-24">
      {/* Hot Discussions */}
      <div className="bg-background-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            🔥 {t("community.hotPosts")}
          </h3>
        </div>
        <div className="divide-y divide-border">
          {hotPosts.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-foreground-subtle">
              {t("community.noHotPosts")}
            </div>
          ) : (
            hotPosts.map((p, i) => (
              <Link
                key={p.id}
                href={`/post/${p.id}`}
                className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-background-elevated transition-colors"
              >
                <span className="text-xs font-bold text-[#c9a84c] mt-0.5 w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">{p.translatedTitle || p.title}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-foreground-subtle mt-1">
                    {p.country && <span>{p.country.flagEmoji}</span>}
                    <span>@{p.author.username}</span>
                    <span className="ml-auto">🔥{p.reactionCount} 💬{p.commentCount}</span>
                  </div>
                </div>
                {p.images?.[0]?.originalUrl && (
                  <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-background-elevated">
                    <Image src={p.images[0].originalUrl} alt="" width={36} height={36} className="object-cover w-full h-full" />
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Community guidelines */}
      <div className="bg-background-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
          📋 {t("community.guidelines")}
        </h3>
        <ul className="space-y-1.5 text-[11px] text-foreground-subtle leading-relaxed">
          <li className="flex gap-1.5"><span>✅</span>{t("community.rule1")}</li>
          <li className="flex gap-1.5"><span>✅</span>{t("community.rule2")}</li>
          <li className="flex gap-1.5"><span>✅</span>{t("community.rule3")}</li>
          <li className="flex gap-1.5"><span>❌</span>{t("community.rule4")}</li>
        </ul>
      </div>
    </div>
  );

  return (
    <MainLayout sidebarContent={communitySidebar}>
      <div className="space-y-4 py-4">
        {/* Header + Write Button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t("community.title")}</h1>
            <p className="text-sm text-foreground-subtle">{t("community.subtitle")}</p>
          </div>
          {session?.user && (
            <button
              onClick={() => setShowWrite(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#c9a84c] text-black font-medium text-sm hover:bg-[#b8963f] transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
              </svg>
              {t("community.writePost")}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => {
                setSearchQuery(e.target.value.trim());
                setFeedKey((k) => k + 1);
              }, 500);
            }}
            placeholder={t("community.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-2.5 bg-background-surface border border-border rounded-xl text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(""); setSearchQuery(""); setFeedKey((k) => k + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { value: "", label: t("community.categoryAll"), icon: "🔖" },
            { value: "general", label: t("community.categoryGeneral"), icon: "💬" },
            { value: "meme-talk", label: t("community.categoryMemeTalk"), icon: "🎭" },
            { value: "question", label: t("community.categoryQuestion"), icon: "❓" },
            { value: "country", label: t("community.categoryCountry"), icon: "🌍" },
            { value: "tips", label: t("community.categoryTips"), icon: "💡" },
            { value: "off-topic", label: t("community.categoryOffTopic"), icon: "🗣️" },
          ].map((cat) => (
            <button
              key={cat.value}
              onClick={() => { setCategoryFilter(cat.value); setFeedKey((k) => k + 1); }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border transition-all ${
                categoryFilter === cat.value
                  ? "border-[#c9a84c] bg-[#c9a84c]/15 text-[#c9a84c]"
                  : "border-border bg-background-surface text-foreground-subtle hover:text-foreground-muted hover:border-border-active"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort + Country filters */}
        <div className="flex items-center gap-2 flex-wrap">
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

          {userCountryId && (
            <button
              onClick={() => { setCountryFilter(countryFilter === userCountryId ? "" : userCountryId); setFeedKey((k) => k + 1); }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                countryFilter === userCountryId
                  ? "border-[#c9a84c] bg-[#c9a84c]/15 text-[#c9a84c]"
                  : "border-[#c9a84c]/30 text-[#c9a84c]/70 hover:border-[#c9a84c] hover:text-[#c9a84c]"
              }`}
            >
              {userCountryFlag} {t("filter.myCountry")}
            </button>
          )}

          {/* Active filter count */}
          {(searchQuery || categoryFilter || countryFilter) && (
            <button
              onClick={() => {
                setSearchInput(""); setSearchQuery("");
                setCategoryFilter(""); setCountryFilter("");
                setSort("recent"); setFeedKey((k) => k + 1);
              }}
              className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              {t("community.clearFilters")}
            </button>
          )}
        </div>

        {/* Feed */}
        <FeedList
          key={feedKey}
          translateTo={translateTo}
          filters={{ postType: "community", sort, country: countryFilter || undefined, search: searchQuery || undefined, tag: categoryFilter || undefined }}
          emptyMessage={t("community.emptyDiscussion")}
          emptySubtext={t("community.emptyDiscussionSubtext")}
          emptyActionLabel={t("community.writePost")}
          emptyActionClick={session?.user ? () => setShowWrite(true) : undefined}
          emptyActionHref={session?.user ? undefined : "/api/auth/signin"}
          emptyIcon="💬"
        />
      </div>

      {/* ── Write Modal ──────────────────────────────────────────────────── */}
      {showWrite && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="write-modal-title">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWrite(false)} />

          {/* Modal */}
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-lg bg-background-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 id="write-modal-title" className="text-base font-bold text-foreground">{t("community.newPost")}</h2>
              <button type="button" onClick={() => setShowWrite(false)} className="text-foreground-subtle hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("community.titlePlaceholder")}
                maxLength={200}
                autoFocus
                className="w-full px-0 py-1 border-0 border-b border-border bg-transparent text-base font-semibold text-foreground focus:outline-none focus:border-[#c9a84c]/50 placeholder-foreground-subtle"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("community.bodyPlaceholder")}
                rows={5}
                maxLength={5000}
                className="w-full px-0 py-1 border-0 bg-transparent text-sm text-foreground resize-none focus:outline-none placeholder-foreground-subtle leading-relaxed"
              />

              {/* Category selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-foreground-subtle">{t("community.selectCategory")}:</span>
                {[
                  { value: "general", label: t("community.categoryGeneral"), icon: "💬" },
                  { value: "meme-talk", label: t("community.categoryMemeTalk"), icon: "🎭" },
                  { value: "question", label: t("community.categoryQuestion"), icon: "❓" },
                  { value: "country", label: t("community.categoryCountry"), icon: "🌍" },
                  { value: "tips", label: t("community.categoryTips"), icon: "💡" },
                  { value: "off-topic", label: t("community.categoryOffTopic"), icon: "🗣️" },
                ].map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setPostCategory(cat.value)}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-full border transition-all ${
                      postCategory === cat.value
                        ? "border-[#c9a84c] bg-[#c9a84c]/15 text-[#c9a84c]"
                        : "border-border text-foreground-subtle hover:border-border-active"
                    }`}
                  >
                    <span>{cat.icon}</span>{cat.label}
                  </button>
                ))}
              </div>

              {/* Image preview */}
              {imagePreview && (
                <div className="relative inline-block">
                  <Image src={imagePreview} alt="" width={200} height={150} className="rounded-xl object-cover max-h-40" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 text-white rounded-full text-xs flex items-center justify-center hover:bg-black/90 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-background-elevated/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-foreground-subtle hover:text-foreground-muted hover:bg-background-surface border border-border transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                  <span className="text-[10px] text-foreground-subtle">{userCountryFlag} {t("community.postingAs")}</span>
                )}
              </div>
              <button
                type="submit"
                disabled={!title.trim() || submitting}
                className="px-5 py-2 rounded-xl bg-[#c9a84c] text-black text-sm font-bold disabled:opacity-40 hover:bg-[#b8963f] transition-colors"
              >
                {uploading ? t("community.uploading") : submitting ? t("common.loading") : t("community.post")}
              </button>
            </div>
          </form>
        </div>
      )}
    </MainLayout>
  );
}
