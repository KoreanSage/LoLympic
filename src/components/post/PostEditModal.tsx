"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";

const CATEGORY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
  { value: "anime", label: "Anime" },
  { value: "gaming", label: "Gaming" },
  { value: "entertainment", label: "Entertainment" },
  { value: "community", label: "Community" },
  { value: "meme", label: "Meme" },
];

interface PostEditModalProps {
  post: {
    id: string;
    title: string;
    body?: string | null;
    category?: string | null;
    tags?: string[];
  };
  onClose: () => void;
  onSaved: () => void;
}

export default function PostEditModal({ post, onClose, onSaved }: PostEditModalProps) {
  const { toast } = useToast();
  const { t } = useTranslation();

  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body || "");
  const [category, setCategory] = useState(post.category || "");
  const [tags, setTags] = useState<string[]>(post.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().replace(/^#/, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        handleAddTag();
      }
      if (e.key === "Backspace" && !tagInput && tags.length > 0) {
        setTags((prev) => prev.slice(0, -1));
      }
    },
    [handleAddTag, tagInput, tags]
  );

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError(t("post.titleRequired") || "Title is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    // Build payload with only changed fields
    const payload: Record<string, unknown> = {};
    if (title !== post.title) payload.title = title.trim();
    if (body !== (post.body || "")) payload.body = body.trim();
    if (category !== (post.category || "")) payload.category = category;
    if (JSON.stringify(tags) !== JSON.stringify(post.tags || [])) payload.tags = tags;

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast(t("post.editSaved") || "Changes saved", "success");
        onSaved();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || t("common.error") || "Failed to save changes");
      }
    } catch {
      setError(t("common.error") || "Failed to save changes");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="bg-background-elevated border border-border rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">
            {t("post.editPost") || "Edit Post"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-overlay transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-foreground-muted mb-1.5">
              {t("post.title") || "Title"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-border-active transition-colors"
              placeholder={t("post.titlePlaceholder") || "Post title"}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs text-foreground-muted mb-1.5">
              {t("post.body") || "Body"}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-border-active transition-colors"
              rows={5}
              placeholder={t("post.bodyPlaceholder") || "Post body (optional)"}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-foreground-muted mb-1.5">
              {t("post.category") || "Category"}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-active transition-colors"
            >
              <option value="">{t("post.noCategory") || "No category"}</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-foreground-muted mb-1.5">
              {t("post.tags") || "Tags"}
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-background-surface border border-border rounded-lg min-h-[40px] focus-within:border-border-active transition-colors">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#c9a84c]/10 text-[#c9a84c] border border-[#c9a84c]/20"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-[#d4b85c] transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleAddTag}
                className="flex-1 min-w-[80px] bg-transparent text-sm text-foreground placeholder-foreground-subtle outline-none"
                placeholder={tags.length === 0 ? (t("post.addTags") || "Add tags...") : ""}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" size="md" onClick={onClose}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={!title.trim()}
          >
            {t("post.saveChanges") || "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
