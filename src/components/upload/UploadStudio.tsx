"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "./ImageUploader";
import Button from "@/components/ui/Button";

const ALL_LANGUAGES = [
  { code: "ko", label: "한국어", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "en", label: "English", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "ja", label: "日本語", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "zh", label: "中文", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "es", label: "Español", flag: "\u{1F1F2}\u{1F1FD}" },
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("ko");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);

  const isGif = imageFile?.type === "image/gif";

  const handleImageSelected = (file: File, previewUrl: string) => {
    setImageFile(file);
    setImagePreview(previewUrl);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handlePublish = async () => {
    if (!imageFile || !title.trim()) return;

    setIsPublishing(true);

    const targetLangs = ALL_LANGUAGES.filter((l) => l.code !== sourceLanguage);
    const langStatuses: Record<string, TranslationStatus> = {};
    targetLangs.forEach((l) => (langStatuses[l.code] = "pending"));

    setProgress({ phase: "uploading", languages: langStatuses });

    try {
      // Step 1: Upload image
      const formData = new FormData();
      formData.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Upload failed");
      }
      const uploadData = await uploadRes.json();

      // Step 2: Create post
      setProgress((p) => p && { ...p, phase: "creating" });

      const postRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sourceLanguage,
          category: category || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          images: [
            {
              url: uploadData.url,
              width: uploadData.width,
              height: uploadData.height,
              mimeType: uploadData.mimeType,
              fileSizeBytes: uploadData.fileSizeBytes,
            },
          ],
        }),
      });
      if (!postRes.ok) {
        const err = await postRes.json();
        throw new Error(err.error || "Failed to create post");
      }
      const postData = await postRes.json();
      const postId = postData.post.id;

      // Step 3: Translate to each language one-by-one (skip for GIF)
      if (uploadData.mimeType === "image/gif") {
        setProgress((p) => p && { ...p, phase: "done", postId });
        setTimeout(() => router.push(`/post/${postId}`), 1500);
        return;
      }

      setProgress((p) => p && { ...p, phase: "translating", postId });

      for (const lang of targetLangs) {
        setProgress((p) => {
          if (!p) return p;
          return {
            ...p,
            languages: { ...p.languages, [lang.code]: "translating" },
          };
        });

        try {
          const translateRes = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId,
              sourceLanguage,
              targetLanguages: [lang.code],
              imageUrl: uploadData.url,
            }),
          });

          if (!translateRes.ok) {
            throw new Error("Translation API error");
          }

          const translateData = await translateRes.json();
          const langResult = translateData.translations?.[lang.code];
          if (langResult?.error) {
            throw new Error(langResult.error);
          }

          setProgress((p) => {
            if (!p) return p;
            return {
              ...p,
              languages: { ...p.languages, [lang.code]: "done" },
            };
          });
        } catch {
          setProgress((p) => {
            if (!p) return p;
            return {
              ...p,
              languages: { ...p.languages, [lang.code]: "error" },
            };
          });
        }
      }

      // Done! (even if some translations failed, post is created)
      setProgress((p) => p && { ...p, phase: "done" });

      // Trigger image generation in background (non-blocking, best-effort)
      // Clean image + translated images — don't await, just fire off
      fetch("/api/translate/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, type: "clean" }),
      }).catch(() => {});

      // Redirect after a moment
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
          {/* Header */}
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
              {progress.phase === "uploading" && "Uploading image..."}
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

          {/* Language progress */}
          <div className="space-y-3">
            {ALL_LANGUAGES.filter((l) => l.code !== sourceLanguage).map((lang) => {
              const status = progress.languages[lang.code];
              return (
                <div
                  key={lang.code}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-background-elevated border border-border"
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="flex-1 text-sm font-medium text-foreground-muted">
                    {lang.label}
                  </span>
                  {status === "pending" && (
                    <span className="text-xs text-foreground-subtle">Waiting...</span>
                  )}
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
                  {status === "error" && (
                    <span className="text-xs text-red-400">Failed</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions: retry failed or continue */}
          {progress.phase === "done" && Object.values(progress.languages).some((s) => s === "error") && (
            <div className="mt-4 text-center">
              <p className="text-xs text-foreground-subtle mb-2">
                Some translations failed. You can retry them from the post page.
              </p>
            </div>
          )}
          {progress.phase === "error" && (
            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setProgress(null);
                  setIsPublishing(false);
                }}
                className="flex-1"
              >
                Go Back
              </Button>
              <Button onClick={handlePublish} className="flex-1">
                Retry
              </Button>
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
        {/* Left: Image */}
        <div>
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-border bg-background-surface">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full object-contain max-h-[500px]"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-background/70 hover:bg-background text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <ImageUploader onImageSelected={handleImageSelected} />
          )}
        </div>

        {/* Right: Form */}
        <div className="space-y-4">
          <div className="bg-background-surface border border-border rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Post Details</h2>
              <p className="text-xs text-foreground-subtle">
                {isGif
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
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
              >
                <option value="">Select category</option>
                <option value="reaction">Reaction</option>
                <option value="comic">Comic</option>
                <option value="screenshot">Screenshot</option>
                <option value="classic">Classic</option>
                <option value="anime">Anime</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Tags
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="funny, reaction, korean-humor..."
                className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
              />
              <p className="text-[10px] text-foreground-subtle mt-1">Comma-separated</p>
            </div>

            {/* Translation preview */}
            {isGif ? (
              <div className="bg-background-elevated rounded-lg p-3 border border-border">
                <p className="text-xs text-foreground-subtle">
                  GIF will be published as-is without AI translation.
                </p>
              </div>
            ) : (
              <div className="bg-background-elevated rounded-lg p-3 border border-border">
                <p className="text-xs text-foreground-subtle mb-2">Auto-translating to:</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_LANGUAGES.filter((l) => l.code !== sourceLanguage).map(
                    (lang) => (
                      <span
                        key={lang.code}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background-overlay text-xs text-foreground-muted"
                      >
                        {lang.flag} {lang.label}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Publish */}
            <Button
              onClick={handlePublish}
              disabled={!imageFile || !title.trim() || isPublishing}
              className="w-full"
            >
              {isGif ? "Publish GIF" : "Publish & Translate"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
