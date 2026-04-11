"use client";

// ---------------------------------------------------------------------------
// GlobalTranslationIndicator — floating bottom-right widget that follows the
// user across pages while any post's async translation is in progress.
// Reads post IDs from the translation-tracker localStorage store, polls
// /api/posts/[id]/translation-status for each, and auto-removes completed
// posts. Disappears when nothing is in flight.
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getTrackedPosts,
  removeTrackedPost,
  subscribeTracker,
  type TrackedPost,
} from "@/lib/translation-tracker";

interface PostStatus {
  postId: string;
  title?: string;
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
}

const POLL_INTERVAL_MS = 2500;

export function GlobalTranslationIndicator() {
  const [tracked, setTracked] = useState<TrackedPost[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PostStatus>>({});
  const [collapsed, setCollapsed] = useState(false);

  // Sync with the tracker store (same-tab + cross-tab via storage event)
  useEffect(() => {
    const refresh = () => setTracked(getTrackedPosts());
    refresh();
    return subscribeTracker(refresh);
  }, []);

  // Poll each tracked post's status
  const pollOne = useCallback(async (postId: string) => {
    try {
      const r = await fetch(`/api/posts/${postId}/translation-status`);
      if (!r.ok) return;
      const data = await r.json();
      const summary = data.summary;
      if (!summary || typeof summary.total !== "number") return;

      setStatuses((prev) => ({
        ...prev,
        [postId]: {
          postId,
          title: tracked.find((t) => t.postId === postId)?.title,
          total: summary.total,
          completed: summary.completed,
          failed: summary.failed,
          inProgress: summary.inProgress,
        },
      }));

      // Remove from tracker once all jobs settle (and there was actually work)
      if (summary.total > 0 && summary.inProgress === 0) {
        // Keep the "done" state visible briefly, then remove
        setTimeout(() => {
          removeTrackedPost(postId);
          setStatuses((prev) => {
            const next = { ...prev };
            delete next[postId];
            return next;
          });
        }, 2000);
      }
    } catch {
      // swallow transient errors
    }
  }, [tracked]);

  useEffect(() => {
    if (tracked.length === 0) return;
    // Immediate fetch
    tracked.forEach((t) => pollOne(t.postId));
    const id = window.setInterval(() => {
      // Skip while tab is hidden to save server load
      if (document.visibilityState === "hidden") return;
      tracked.forEach((t) => pollOne(t.postId));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tracked, pollOne]);

  // Hide when nothing is tracked
  if (tracked.length === 0) return null;

  const activeStatuses = tracked
    .map((t) => statuses[t.postId])
    .filter((s): s is PostStatus => !!s);

  // If we haven't received any status yet, show a simple "starting" state
  const showStarting = activeStatuses.length === 0;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] sm:w-80"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-xl border border-yellow-400/30 bg-[#1a1a1a]/95 backdrop-blur-md shadow-xl overflow-hidden">
        {/* Header bar */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors"
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
            <span className="text-sm font-medium text-yellow-200 truncate">
              번역 중…
            </span>
            <span className="text-xs text-yellow-300/70 flex-shrink-0">
              {tracked.length}{tracked.length > 1 ? " 개 게시물" : " 개"}
            </span>
          </div>
          <svg
            className={`w-4 h-4 text-yellow-300/70 flex-shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Expanded content */}
        {!collapsed && (
          <div className="border-t border-white/5 px-3 py-2.5 space-y-2">
            {showStarting && (
              <p className="text-xs text-yellow-300/70">번역 작업 준비 중…</p>
            )}
            {activeStatuses.map((s) => {
              const percent = s.total > 0
                ? Math.round(((s.completed + s.failed) / s.total) * 100)
                : 0;
              const trackedInfo = tracked.find((t) => t.postId === s.postId);
              const titleText = trackedInfo?.title || "게시물";
              return (
                <Link
                  key={s.postId}
                  href={`/post/${s.postId}`}
                  className="block hover:bg-white/5 rounded-lg p-2 -mx-1 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-foreground truncate flex-1">
                      {titleText}
                    </span>
                    <span className="text-[10px] text-yellow-300/80 flex-shrink-0 tabular-nums">
                      {s.completed}/{s.total}
                      {s.failed > 0 && (
                        <span className="text-red-400 ml-1">· {s.failed} 실패</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-yellow-300 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
