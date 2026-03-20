"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "./ImageUploader";
import ImageCarousel from "@/components/ui/ImageCarousel";
import Button from "@/components/ui/Button";

const ALL_LANGUAGES = [
  { code: "ko", label: "한국어", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "en", label: "English", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "ja", label: "日本語", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "zh", label: "中文", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "es", label: "Español", flag: "\u{1F1F2}\u{1F1FD}" },
  { code: "hi", label: "हिन्दी", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "ar", label: "العربية", flag: "\u{1F1F8}\u{1F1E6}" },
];

const MAX_IMAGES = 10;

const CATEGORIES = [
  { value: "daily", label: "Daily", emoji: "☕" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "politics", label: "Politics", emoji: "🏛️" },
  { value: "anime", label: "Anime", emoji: "🎌" },
  { value: "gaming", label: "Gaming", emoji: "🎮" },
  { value: "entertainment", label: "Entertainment", emoji: "🎬" },
];

const POPULAR_TAGS = [
  "funny", "relatable", "wholesome", "cringe", "cursed",
  "classic", "trending", "oc", "shitpost", "dank",
];

type TranslationStatus = "pending" | "translating" | "done" | "error";

interface PublishProgress {
  phase: "uploading" | "creating" | "translating" | "done" | "error";
  languages: Record<string, TranslationStatus>;
  error?: string;
  postId?: string;
}

export default function UploadStudio() {
  const router = useRouter();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("ko");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);

  const hasGif = imageFiles.some((f) => f.type === "image/gif");

  const handleImagesSelected = (files: File[], previewUrls: string[]) => {
    const combined = [...imageFiles, ...files].slice(0, MAX_IMAGES);
    const combinedPreviews = [...imagePreviews, ...previewUrls].slice(0, MAX_IMAGES);
    setImageFiles(combined);
    setImagePreviews(combinedPreviews);
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handlePublish = async () => {
    if (imageFiles.length === 0 || !title.trim()) return;

    setIsPublishing(true);

    const targetLangs = ALL_LANGUAGES.filter((l) => l.code !== sourceLanguage);
    const langStatuses: Record<string, TranslationStatus> = {};
    targetLangs.forEach((l) => (langStatuses[l.code] = "pending"));

    setProgress({ phase: "uploading", languages: langStatuses });

    try {
      // Step 1: Upload all images
      const uploadedImages: Array<{
        url: string;
        width?: number;
        height?: number;
        mimeType?: string;
        fileSizeBytes?: number;
      }> = [];

      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "Upload failed");
        }
        const data = await uploadRes.json();
        uploadedImages.push({
          url: data.url,
          width: data.width,
          height: data.height,
          mimeType: data.mimeType,
          fileSizeBytes: data.fileSizeBytes,
        });
      }

      // Step 2: Create post
      setProgress((p) => p && { ...p, phase: "creating" });

      const postRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sourceLanguage,
          category: category || null,
          tags,
          images: uploadedImages,
        }),
      });
      if (!postRes.ok) {
        const err = await postRes.json();
        throw new Error(err.error || "Failed to create post");
      }
      const postData = await postRes.json();
      const postId = postData.post.id;

      // Step 3: Translate first image only (skip for GIF-only posts)
      const firstImage = uploadedImages[0];
      if (firstImage?.mimeType === "image/gif" && uploadedImages.length === 1) {
        setProgress((p) => p && { ...p, phase: "done", postId });
        setTimeout(() => router.push(`/post/${postId}`), 1500);
        return;
      }

      setProgress((p) => p && { ...p, phase: "translating", postId });

      setProgress((p) => {
        if (!p) return p;
        const langs = { ...p.languages };
        targetLangs.forEach((l) => (langs[l.code] = "translating"));
        return { ...p, languages: langs };
      });

      // Translate using first non-GIF image
      const translateImage = uploadedImages.find((img) => img.mimeType !== "image/gif") || uploadedImages[0];

      const translatePromises = targetLangs.map(async (lang) => {
        try {
          const translateRes = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId,
              sourceLanguage,
              targetLanguages: [lang.code],
              imageUrl: translateImage.url,
            }),
          });

          if (!translateRes.ok) throw new Error("Translation API error");

          const translateData = await translateRes.json();
          const langResult = translateData.translations?.[lang.code];
          if (langResult?.error) throw new Error(langResult.error);

          setProgress((p) => {
            if (!p) return p;
            return { ...p, languages: { ...p.languages, [lang.code]: "done" } };
          });
        } catch {
          setProgress((p) => {
            if (!p) return p;
            return { ...p, languages: { ...p.languages, [lang.code]: "error" } };
          });
        }
      });

      await Promise.allSettled(translatePromises);

      setProgress((p) => p && { ...p, phase: "done" });

      // Background image generation
      fetch("/api/translate/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, type: "clean" }),
      }).catch(() => {});

      setTimeout(() => {
        if (postId) router.push(`/post/${postId}`);
      }, 2000);
    } catch (error) {
      setProgress((p) => ({
        ...(p || { languages: langStatuses }),
        phase: "error",
        error: error instanceof Error ? error.message : "Something went wrong",
      }));
      setIsPublishing(false);
    }
  };

  // Publishing overlay
  if (progress) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-background-surface border border-border rounded-2xl p-8">
          <div className="text-center mb-8">
            {progress.phase === "done" ? (
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : progress.phase === "error" ? (
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="w-16 h-16 rounded-full border-4 border-border border-t-[#c9a84c] animate-spin" />
              </div>
            )}

            <h2 className="text-xl font-bold text-foreground">
              {progress.phase === "uploading" && `Uploading ${imageFiles.length} image${imageFiles.length > 1 ? "s" : ""}...`}
              {progress.phase === "creating" && "Creating post..."}
              {progress.phase === "translating" && "Translating your meme..."}
              {progress.phase === "done" && "Published!"}
              {progress.phase === "error" && "Something went wrong"}
            </h2>

            {progress.phase === "translating" && (
              <p className="text-sm text-foreground-subtle mt-2">
                AI is translating to {ALL_LANGUAGES.length - 1} languages
              </p>
            )}
            {progress.phase === "done" && (
              <p className="text-sm text-foreground-subtle mt-2">Redirecting to your post...</p>
            )}
            {progress.phase === "error" && (
              <p className="text-sm text-red-400 mt-2">{progress.error}</p>
            )}
          </div>

          <div className="space-y-3">
            {ALL_LANGUAGES.filter((l) => l.code !== sourceLanguage).map((lang) => {
              const status = progress.languages[lang.code];
              return (
                <div
                  key={lang.code}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-background-elevated border border-border"
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="flex-1 text-sm font-medium text-foreground-muted">{lang.label}</span>
                  {status === "pending" && <span className="text-xs text-foreground-subtle">Waiting...</span>}
                  {status === "translating" && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-border-active border-t-[#c9a84c] animate-spin" />
                      <span className="text-xs text-[#c9a84c]">Translating</span>
                    </div>
                  )}
                  {status === "done" && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs text-green-400">Done</span>
                    </div>
                  )}
                  {status === "error" && <span className="text-xs text-red-400">Failed</span>}
                </div>
              );
            })}
          </div>

          {progress.phase === "done" && Object.values(progress.languages).some((s) => s === "error") && (
            <div className="mt-4 text-center">
              <p className="text-xs text-foreground-subtle mb-2">Some translations failed. You can retry them from the post page.</p>
            </div>
          )}
          {progress.phase === "error" && (
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => { setProgress(null); setIsPublishing(false); }} className="flex-1">
                Go Back
              </Button>
              <Button onClick={handlePublish} className="flex-1">Retry</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Images */}
        <div className="space-y-4">
          {imagePreviews.length > 0 ? (
            <>
              {/* Carousel preview */}
              <div className="rounded-xl overflow-hidden border border-border bg-background-surface">
                <ImageCarousel>
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative">
                      <img
                        src={preview}
                        alt={`Preview ${i + 1}`}
                        className="w-full object-contain max-h-[500px]"
                      />
                      <button
                        onClick={() => handleRemoveImage(i)}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </ImageCarousel>
              </div>

              {/* Thumbnail strip */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imagePreviews.map((preview, i) => (
                  <div key={i} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveImage(i)}
                      className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Add more button */}
                {imageFiles.length < MAX_IMAGES && (
                  <label className="shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-[#c9a84c]/40 hover:border-[#c9a84c] bg-[#c9a84c]/5 hover:bg-[#c9a84c]/10 flex flex-col items-center justify-center cursor-pointer transition-colors gap-0.5">
                    <svg className="w-5 h-5 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-[9px] text-[#c9a84c] font-medium">Add</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          const newFiles = Array.from(e.target.files).slice(0, MAX_IMAGES - imageFiles.length);
                          const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
                          setImageFiles((prev) => [...prev, ...newFiles]);
                          setImagePreviews((prev) => [...prev, ...newPreviews]);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-foreground-subtle">
                  {imageFiles.length}/{MAX_IMAGES} images
                </p>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </>
          ) : (
            <ImageUploader onImagesSelected={handleImagesSelected} maxFiles={MAX_IMAGES} />
          )}
        </div>

        {/* Right: Form */}
        <div className="space-y-4">
          <div className="bg-background-surface border border-border rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Post Details</h2>
              <p className="text-xs text-foreground-subtle">
                {hasGif && imageFiles.length === 1
                  ? "GIF files will be posted without translation."
                  : "We'll auto-translate to all 5 languages after you publish."}
              </p>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your meme a title..."
                className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                maxLength={100}
              />
            </div>

            {/* Source Language */}
            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Meme Language <span className="text-red-400">*</span>
              </label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
              >
                {ALL_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-foreground-subtle mt-1">
                The language of the text in the meme image
              </p>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(category === cat.value ? "" : cat.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      category === cat.value
                        ? "bg-[#c9a84c] text-black"
                        : "bg-background-elevated border border-border-hover text-foreground-muted hover:border-border-active"
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">Tags</label>
              {/* Selected tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#c9a84c]/15 text-[#c9a84c] text-xs"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((t) => t !== tag))}
                        className="hover:text-white transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Tag input */}
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                      e.preventDefault();
                      const newTag = tagInput.trim().toLowerCase().replace(/,/g, "");
                      if (newTag && !tags.includes(newTag) && tags.length < 10) {
                        setTags([...tags, newTag]);
                      }
                      setTagInput("");
                    }
                  }}
                  placeholder={tags.length >= 10 ? "Max 10 tags" : "Type and press Enter..."}
                  disabled={tags.length >= 10}
                  className="flex-1 bg-background-elevated border border-border-hover rounded-lg px-3 py-2 text-xs text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors disabled:opacity-50"
                />
              </div>
              {/* Popular tags */}
              {tags.length < 10 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {POPULAR_TAGS.filter((t) => !tags.includes(t)).slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (tags.length < 10) setTags([...tags, tag]);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] text-foreground-subtle border border-border hover:border-[#c9a84c]/40 hover:text-[#c9a84c] transition-colors"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Translation preview */}
            {hasGif && imageFiles.length === 1 ? (
              <div className="bg-background-elevated rounded-lg p-3 border border-border">
                <p className="text-xs text-foreground-subtle">GIF will be published as-is without AI translation.</p>
              </div>
            ) : (
              <div className="bg-background-elevated rounded-lg p-3 border border-border">
                <p className="text-xs text-foreground-subtle mb-2">Auto-translating to:</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_LANGUAGES.filter((l) => l.code !== sourceLanguage).map((lang) => (
                    <span key={lang.code} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background-overlay text-xs text-foreground-muted">
                      {lang.flag} {lang.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Publish */}
            <Button
              onClick={handlePublish}
              disabled={imageFiles.length === 0 || !title.trim() || isPublishing}
              className="w-full"
            >
              {hasGif && imageFiles.length === 1 ? "Publish GIF" : "Publish & Translate"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
