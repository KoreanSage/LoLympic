"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";

interface Activity {
  id: string;
  type: "reaction" | "post";
  username: string;
  displayName: string | null;
  countryFlag: string;
  message: string;
  postId?: string;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

export default function ActivityFeed() {
  const { t } = useTranslation();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard/activity");
      if (!res.ok) return;
      const data = await res.json();
      if (data.activities) setActivities(data.activities);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();

    function startPolling() {
      intervalRef.current = setInterval(fetchActivity, 15000);
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchActivity();
        startPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchActivity]);

  if (loading && activities.length === 0) return null;
  if (activities.length === 0) return null;

  return (
    <div className="bg-background-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          {t("leaderboard.liveActivity") || "Live Activity"}
        </h3>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-center gap-2 text-xs py-1">
            <span className="text-sm flex-shrink-0">{activity.countryFlag || "\uD83C\uDF10"}</span>
            <div className="flex-1 min-w-0 truncate text-foreground-subtle">
              <span className="font-medium text-foreground">
                {activity.displayName || activity.username}
              </span>
              {" "}
              {activity.type === "reaction" ? (
                <>
                  {"\uD83D\uDD25"}{" "}
                  {activity.postId ? (
                    <Link href={`/post/${activity.postId}`} className="text-[#c9a84c] hover:underline">
                      reacted
                    </Link>
                  ) : (
                    "reacted"
                  )}
                </>
              ) : (
                <>
                  {"\uD83D\uDCF7"}{" "}
                  {activity.postId ? (
                    <Link href={`/post/${activity.postId}`} className="text-[#c9a84c] hover:underline">
                      uploaded a meme
                    </Link>
                  ) : (
                    "uploaded a meme"
                  )}
                </>
              )}
            </div>
            <span className="text-[10px] text-foreground-subtle/60 flex-shrink-0">
              {timeAgo(activity.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
