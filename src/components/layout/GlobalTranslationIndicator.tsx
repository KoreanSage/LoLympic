"use client";

// ---------------------------------------------------------------------------
// GlobalTranslationIndicator — floating bottom-right widget that follows the
// user across pages while any post's async translation is in progress.
// Reads post IDs from the translation-tracker localStorage store, polls
// /api/posts/[id]/translation-status for each, and auto-removes completed
// posts. Disappears when nothing is in flight.
// ---------------------------------------------------------------------------
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
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
const DONE_GRACE_MS = 2000;

export function GlobalTranslationIndicator() {
  const { t } = useTranslation();
  const [tracked, setTracked] = useState<TrackedPost[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PostStatus>>({});
  const [collapsed, setCollapsed] = useState(false);

  // Keep a ref to `tracked` so `pollOne` can read it without becoming a new
  // function identity on every render. Without this, the effect below would
  // tear down and recreate the setInterval on every render, leaking timers.
  const trackedRef = useRef<TrackedPost[]>(tracked);
  useEffect(() => {
    trackedRef.current = tracked;
  }, [tracked]);

  // Track pending "done" cleanup timers so we can clear them on unmount.
  const cleanupTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Sync with the tracker store (same-tab + cross-tab via storage event)
  useEffect(() => {
    const refresh = () => setTracked(getTrackedPosts());
    refresh();
    return subscribeTracker(refresh);
  }, []);

  // Poll each tracked post's status. Stable identity — reads from refs only.
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
          title: trackedRef.current.find((x) => x.postId === postId)?.title,
          total: summary.total,
          completed: summary.completed,
          failed: summary.failed,
          inProgress: summary.inProgress,
        },
      }));

      // Remove from tracker once all jobs settle (and there was actually work).
      // Keep the "done" state visible briefly, then remove. Timer is tracked
      // so it can be cancelled on unmount or on repeated completion events.
      if (summary.total > 0 && summary.inProgress === 0) {
        const timers = cleanupTimersRef.current;
        if (!timers.has(postId)) {
          const handle = setTimeout(() => {
            removeTrackedPost(postId);
            setStatuses((prev) => {
              const next = { ...prev };
              delete next[postId];
              return next;
            });
            timers.delete(postId);
          }, DONE_GRACE_MS);
          timers.set(postId, handle);
        }
      }
    } catch {
      // swallow transient errors
    }
  }, []);

  // Drive the polling loop. Only restarts when the set of tracked post IDs
  // changes, not on every render of pollOne.
  const trackedKey = tracked.map((t) => t.postId).sort().join(",");
  useEffect(() => {
    if (tracked.length === 0) return;
    // Immediate fetch
    for (const t of tracked) pollOne(t.postId);
    const handle = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      for (const t of trackedRef.current) pollOne(t.postId);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedKey, pollOne]);

  // Clear all pending cleanup timers on unmount to avoid leaks.
  useEffect(() => {
    const timers = cleanupTimersRef.current;
    return () => {
      timers.forEach((handle) => clearTimeout(handle));
      timers.clear();
    };
  }, []);

  // Hide when nothing is tracked
  if (tracked.length === 0) return null;

  const activeStatuses = tracked
    .map((t) => statuses[t.postId])
    .filter((s): s is PostStatus => !!s);

  // If we haven't received any status yet, show a simple "starting" state
  const showStarting = activeStatuses.length === 0;
  const inProgressLabel = t("translation.inProgress");
  const startingLabel = t("translation.starting");
  const postsLabel =
    tracked.length > 1
      ? t("translation.postsCountPlural")
      : t("translation.postsCountSingular");
  const failedLabel = t("translation.failedShort");
  const defaultPostTitle = t("translation.defaultTitle");

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
              {inProgressLabel}
            </span>
            <span className="text-xs text-yellow-300/70 flex-shrink-0">
              {tracked.length} {postsLabel}
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
              <p className="text-xs text-yellow-300/70">{startingLabel}</p>
            )}
            {activeStatuses.map((s) => {
              const percent = s.total > 0
                ? Math.round(((s.completed + s.failed) / s.total) * 100)
                : 0;
              const trackedInfo = tracked.find((x) => x.postId === s.postId);
              const titleText = trackedInfo?.title || defaultPostTitle;
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
                        <span className="text-red-400 ml-1">· {s.failed} {failedLabel}</span>
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
