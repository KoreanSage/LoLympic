"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "./ImageUploader";
import ImageCarousel from "@/components/ui/ImageCarousel";
import Button from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";

const ALL_LANGUAGES = [
  { code: "ko", label: "\ud55c\uad6d\uc5b4", icon: "\ud55c" },
  { code: "en", label: "English", icon: "A" },
  { code: "ja", label: "\u65e5\u672c\u8a9e", icon: "\u3042" },
  { code: "zh", label: "\u4e2d\u6587", icon: "\u5b57" },
  { code: "es", label: "Espa\u00f1ol", icon: "\u00d1" },
  { code: "hi", label: "\u0939\u093f\u0928\u094d\u0926\u0940", icon: "\u0905" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629", icon: "\u0639" },
];

const MAX_IMAGES = 10;

type PostType = "meme" | "community";

const CATEGORIES = [
  { value: "daily", label: "Daily", emoji: "\u2615" },
  { value: "sports", label: "Sports", emoji: "\u26bd" },
  { value: "politics", label: "Politics", emoji: "\ud83c\udfdb\ufe0f" },
  { value: "anime", label: "Anime", emoji: "\ud83c\udf8c" },
  { value: "gaming", label: "Gaming", emoji: "\ud83c\udfae" },
  { value: "entertainment", label: "Entertainment", emoji: "\ud83c\udfac" },
];

const POPULAR_TAGS = [
  "funny", "relatable", "wholesome", "cringe", "cursed",
  "classic", "trending", "oc", "shitpost", "dank",
];

type TranslationStatus = "pending" | "translating" | "done" | "error";

interface PublishProgress {
  phase: "uploading" | "creating" | "translating" | "done" | "error";
  uploadProgress?: number;
  uploadedCount?: number;
  totalCount?: number;
  languages: Record<string, TranslationStatus>;
  error?: string;
  postId?: string;
}

function uploadFileWithProgress(
  file: File,
  onProgress: (loaded: number, total: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error("Invalid response")); }
      } else {
        try { const err = JSON.parse(xhr.responseText); reject(new Error(err.error || "Upload failed")); }
        catch { reject(new Error("Upload failed")); }
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export default function UploadStudio() {
  const router = useRouter();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("ko");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const hasImages = imageFiles.length > 0;
  const hasGif = imageFiles.some((f) => f.type === "image/gif");
  const hasVideo = imageFiles.some((f) => f.type.startsWith("video/"));
  const allMediaOnly = hasImages && imageFiles.every((f) => f.type === "image/gif" || f.type.startsWith("video/"));
  const isTextOnly = !hasImages;
  const effectivePostType: PostType = hasImages ? "meme" : "community";

  const handleImagesSelected = (files: File[], previewUrls: string[]) => {
    const combined = [...imageFiles, ...files].slice(0, MAX_IMAGES);
    const combinedPreviews = [...imagePreviews, ...previewUrls].slice(0, MAX_IMAGES);
    setImageFiles(combined);
    setImagePreviews(combinedPreviews);
  };

  const handleRemoveImage = (index: number) => {
    const removedPreview = imagePreviews[index];
    if (removedPreview) URL.revokeObjectURL(removedPreview);
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  const handleClearAll = () => {
    imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const reorder = <T,>(arr: T[]): T[] => {
      const result = [...arr];
      const [moved] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, moved);
      return result;
    };
    setImageFiles(reorder);
    setImagePreviews(reorder);
  };

  const handlePublish = async () => {
    if (!title.trim()) return;

    setIsPublishing(true);

    const targetLangs = ALL_LANGUAGES.filter((l) => l.code !== sourceLanguage);
    const langStatuses: Record<string, TranslationStatus> = {};
    targetLangs.forEach((l) => (langStatuses[l.code] = "pending"));

    if (isTextOnly) {
      // Text-only publish flow
      setProgress({ phase: "creating", languages: langStatuses });

      try {
        // Step 1: Create post (no images)
        const postRes = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            body: bodyText.trim() || null,
            sourceLanguage,
            category: category || effectivePostType,
            tags,
          }),
        });
        if (!postRes.ok) {
          const err = await postRes.json();
          throw new Error(err.error || "Failed to create post");
        }
        const postData = await postRes.json();
        const postId = postData.post.id;

        // Step 2: Translate text
        setProgress((p) => p && { ...p, phase: "translating", postId });
        setProgress((p) => {
          if (!p) return p;
          const langs = { ...p.languages };
          targetLangs.forEach((l) => (langs[l.code] = "translating"));
          return { ...p, languages: langs };
        });

        const translateRes = await fetch("/api/translate/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId,
            title: title.trim(),
            body: bodyText.trim() || null,
            sourceLanguage,
          }),
        });

        if (translateRes.ok) {
          const translateData = await translateRes.json();
          // Update individual language statuses
          setProgress((p) => {
            if (!p) return p;
            const langs = { ...p.languages };
            for (const langCode of Object.keys(translateData.translations || {})) {
              const result = translateData.translations[langCode];
              langs[langCode] = result.error ? "error" : "done";
            }
            return { ...p, languages: langs };
          });
        } else {
          // Translation failed but post was created
          setProgress((p) => {
            if (!p) return p;
            const langs = { ...p.languages };
            targetLangs.forEach((l) => (langs[l.code] = "error"));
            return { ...p, languages: langs };
          });
        }

        setProgress((p) => p && { ...p, phase: "done" });
        trackEvent("meme_upload", { postType: "community" });

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
    } else {
      // Image post publish flow (existing logic)
      setProgress({ phase: "uploading", uploadProgress: 0, uploadedCount: 0, totalCount: imageFiles.length, languages: langStatuses });

      try {
        // Step 1: Upload all images with progress tracking
        const uploadedImages: Array<{
          url: string;
          width?: number;
          height?: number;
          mimeType?: string;
          fileSizeBytes?: number;
        }> = [];

        const totalSize = imageFiles.reduce((sum, f) => sum + f.size, 0);
        let completedSize = 0;

        for (let idx = 0; idx < imageFiles.length; idx++) {
          const file = imageFiles[idx];
          const fileStartSize = completedSize;
          const data = await uploadFileWithProgress(file, (loaded) => {
            const overallProgress = Math.round(((fileStartSize + loaded) / totalSize) * 100);
            setProgress((p) => p && { ...p, uploadProgress: Math.min(overallProgress, 99) });
          });
          completedSize += file.size;
          setProgress((p) => p && {
            ...p,
            uploadProgress: Math.round((completedSize / totalSize) * 100),
            uploadedCount: idx + 1,
          });
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
            body: bodyText.trim() || null,
            sourceLanguage,
            category: category || effectivePostType,
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

        // Step 3: Translate first image only (skip for GIF/video-only posts)
        if (allMediaOnly) {
          // All files are GIF or video — skip image translation, only translate title/body
          setProgress((p) => p && { ...p, phase: "translating", postId });
          setProgress((p) => {
            if (!p) return p;
            const langs = { ...p.languages };
            targetLangs.forEach((l) => (langs[l.code] = "translating"));
            return { ...p, languages: langs };
          });

          const translateRes = await fetch("/api/translate/text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId,
              title: title.trim(),
              body: bodyText.trim() || null,
              sourceLanguage,
            }),
          });

          if (translateRes.ok) {
            const translateData = await translateRes.json();
            setProgress((p) => {
              if (!p) return p;
              const langs = { ...p.languages };
              for (const langCode of Object.keys(translateData.translations || {})) {
                const result = translateData.translations[langCode];
                langs[langCode] = result.error ? "error" : "done";
              }
              return { ...p, languages: langs };
            });
          } else {
            setProgress((p) => {
              if (!p) return p;
              const langs = { ...p.languages };
              targetLangs.forEach((l) => (langs[l.code] = "error"));
              return { ...p, languages: langs };
            });
          }

          setProgress((p) => p && { ...p, phase: "done" });
          trackEvent("meme_upload", { postType: hasVideo ? "video" : "gif" });
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

        // Translate using first static image (skip GIF and video)
        const translateImage = uploadedImages.find((img) => img.mimeType && !img.mimeType.startsWith("video/") && img.mimeType !== "image/gif") || uploadedImages[0];

        // Translate one language at a time with retry
        const translateOneLang = async (langCode: string): Promise<boolean> => {
          const translateRes = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postId,
              sourceLanguage,
              targetLanguages: [langCode],
              imageUrl: translateImage.url,
            }),
          });
          if (!translateRes.ok) throw new Error("Translation API error");
          const translateData = await translateRes.json();
          const langResult = translateData.translations?.[langCode];
          if (langResult?.error) throw new Error(langResult.error);
          return true;
        };

        // Process languages with concurrency limit of 2 + auto-retry
        const CONCURRENCY = 2;
        const langQueue = [...targetLangs];
        const failedLangs: Array<{ code: string; label: string }> = [];

        const processLang = async (lang: { code: string; label: string }) => {
          try {
            await translateOneLang(lang.code);
            setProgress((p) => {
              if (!p) return p;
              return { ...p, languages: { ...p.languages, [lang.code]: "done" } };
            });
          } catch {
            failedLangs.push(lang);
            setProgress((p) => {
              if (!p) return p;
              return { ...p, languages: { ...p.languages, [lang.code]: "error" } };
            });
          }
        };

        // Run with concurrency limit
        const runWithConcurrency = async (items: Array<{ code: string; label: string }>, concurrency: number) => {
          const executing = new Set<Promise<void>>();
          for (const item of items) {
            const p = processLang(item).then(() => { executing.delete(p); });
            executing.add(p);
            if (executing.size >= concurrency) {
              await Promise.race(executing);
            }
          }
          await Promise.allSettled(executing);
        };

        await runWithConcurrency(langQueue, CONCURRENCY);

        // Retry failed languages (one at a time with delay)
        if (failedLangs.length > 0) {
          for (const lang of failedLangs) {
            setProgress((p) => {
              if (!p) return p;
              return { ...p, languages: { ...p.languages, [lang.code]: "translating" } };
            });
            await new Promise((r) => setTimeout(r, 2000));
            try {
              await translateOneLang(lang.code);
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
          }
        }

        setProgress((p) => p && { ...p, phase: "done" });
        trackEvent("meme_upload", { postType: "meme" });

        // Background image generation
        fetch("/api/translate/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, type: "clean" }),
        }).catch((e) => { console.error("Background image generation failed:", e); });

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
              {progress.phase === "uploading" && `Uploading ${imageFiles.length} file${imageFiles.length > 1 ? "s" : ""}...`}
              {progress.phase === "creating" && "Creating post..."}
              {progress.phase === "translating" && (isTextOnly ? "Translating text..." : "Translating your meme...")}
              {progress.phase === "done" && "Published!"}
              {progress.phase === "error" && "Something went wrong"}
            </h2>

            {/* Upload progress bar - only for image posts */}
            {progress.phase === "uploading" && !isTextOnly && (
              <div className="mt-4 w-full max-w-xs mx-auto">
                <div className="flex items-center justify-between text-xs text-foreground-subtle mb-1.5">
                  <span>{progress.uploadedCount ?? 0}/{progress.totalCount ?? 0} files</span>
                  <span>{progress.uploadProgress ?? 0}%</span>
                </div>
                <div className="w-full h-2 bg-background-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#c9a84c] rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress.uploadProgress ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {progress.phase === "translating" && (
              <p className="text-sm text-foreground-subtle mt-2">
                {isTextOnly
                  ? "AI is translating your post to " + (ALL_LANGUAGES.length - 1) + " languages"
                  : "AI is translating to " + (ALL_LANGUAGES.length - 1) + " languages"}
              </p>
            )}
            {progress.phase === "done" && (
              <p className="text-sm text-foreground-subtle mt-2">Redirecting to your post...</p>
            )}
            {progress.phase === "error" && (
              <p className="text-sm text-red-400 mt-2">{progress.error}</p>
            )}
          </div>

          {/* Language progress - show for both text and image posts */}
          {!isTextOnly || progress.phase === "translating" || progress.phase === "done" || progress.phase === "error" ? (
            <div className="space-y-3">
              {ALL_LANGUAGES.filter((l) => l.code !== sourceLanguage).map((lang) => {
                const status = progress.languages[lang.code];
                return (
                  <div
                    key={lang.code}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-background-elevated border border-border"
                  >
                    <span className="text-lg font-bold text-[#c9a84c]">{lang.icon}</span>
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
          ) : null}

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

  const [showOptions, setShowOptions] = useState(false);

  // Main form — single unified flow
  return (
    <div className="max-w-lg mx-auto">
      <div className="space-y-4">
        {/* Media area */}
        {!hasImages ? (
          <ImageUploader onImagesSelected={handleImagesSelected} maxFiles={MAX_IMAGES} />
        ) : (
          <div className="space-y-3">
            {/* Preview */}
            <div className="rounded-xl overflow-hidden border border-border bg-background-surface">
              <ImageCarousel>
                {imagePreviews.map((preview, i) => (
                  <div key={i} className="relative bg-black/5 dark:bg-black/20 flex items-center justify-center h-[400px]">
                    {imageFiles[i]?.type.startsWith("video/") ? (
                      <video src={preview} className="max-w-full max-h-full object-contain" controls muted playsInline />
                    ) : (
                      <img src={preview} alt={`Preview ${i + 1}`} className="max-w-full max-h-full object-contain" />
                    )}
                    <button
                      onClick={() => handleRemoveImage(i)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </ImageCarousel>
            </div>

            {/* Thumbnail strip + Add more */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {imagePreviews.map((preview, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverIndex(i); }}
                    onDragLeave={() => setDragOverIndex((prev) => (prev === i ? null : prev))}
                    onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) handleReorder(dragIndex, i); setDragIndex(null); setDragOverIndex(null); }}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${
                      dragIndex === i ? "opacity-40 border-border" : dragOverIndex === i ? "border-[#c9a84c] scale-105" : "border-border"
                    }`}
                  >
                    {imageFiles[i]?.type.startsWith("video/") ? (
                      <>
                        <video src={preview} className="w-full h-full object-cover pointer-events-none" muted playsInline />
                        <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[8px] px-1 rounded">{"\u25B6"}</div>
                      </>
                    ) : (
                      <img src={preview} alt="" className="w-full h-full object-cover pointer-events-none" />
                    )}
                  </div>
                ))}
                {imageFiles.length < MAX_IMAGES && (
                  <label className="shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-[#c9a84c]/40 hover:border-[#c9a84c] bg-[#c9a84c]/5 hover:bg-[#c9a84c]/10 flex items-center justify-center cursor-pointer transition-colors">
                    <svg className="w-5 h-5 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
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
              <p className="text-[11px] text-foreground-subtle">
                {imageFiles.length}/{MAX_IMAGES}
                {allMediaOnly
                  ? hasVideo ? " \u00b7 Title will be translated" : " \u00b7 GIF, title only"
                  : " \u00b7 Auto-translate to 7 languages"}
              </p>
              <button onClick={handleClearAll} className="text-[11px] text-red-400 hover:text-red-300 transition-colors">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title..."
          className="w-full bg-background-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
          maxLength={100}
        />

        {/* Description — always visible as textarea */}
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="Write a caption..."
          rows={2}
          className="w-full bg-background-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors resize-none"
          maxLength={5000}
        />

        {/* Language selector — inline compact */}
        <div className="flex items-center gap-2 flex-wrap">
          {ALL_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setSourceLanguage(lang.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sourceLanguage === lang.code
                  ? "bg-[#c9a84c] text-black"
                  : "bg-background-surface border border-border text-foreground-muted hover:border-border-active"
              }`}
            >
              {lang.icon}
            </button>
          ))}
        </div>

        {/* More options — collapsed by default */}
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground-muted transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${showOptions ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Category & Tags
        </button>

        {showOptions && (
          <div className="space-y-4 pl-1">
            {/* Category */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(category === cat.value ? "" : cat.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    category === cat.value
                      ? "bg-[#c9a84c] text-black"
                      : "bg-background-elevated border border-border-hover text-foreground-muted hover:border-border-active"
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>

            {/* Tags */}
            <div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#c9a84c]/15 text-[#c9a84c] text-xs">
                      #{tag}
                      <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-white">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                    e.preventDefault();
                    const newTag = tagInput.trim().toLowerCase().replace(/,/g, "");
                    if (newTag && !tags.includes(newTag) && tags.length < 10) setTags([...tags, newTag]);
                    setTagInput("");
                  }
                }}
                placeholder="Add tags..."
                disabled={tags.length >= 10}
                className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2 text-xs text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors disabled:opacity-50"
              />
              {tags.length < 10 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {POPULAR_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((tag) => (
                    <button key={tag} type="button" onClick={() => { if (tags.length < 10) setTags([...tags, tag]); }}
                      className="px-2 py-0.5 rounded text-[11px] text-foreground-subtle border border-border hover:border-[#c9a84c]/40 hover:text-[#c9a84c] transition-colors"
                    >+{tag}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Publish button */}
        <Button
          onClick={handlePublish}
          disabled={!title.trim() || isPublishing}
          className="w-full"
        >
          {allMediaOnly
            ? hasVideo ? "Publish" : "Publish"
            : hasImages
              ? "Publish & Translate"
              : "Publish"}
        </Button>
      </div>
    </div>
  );
}
