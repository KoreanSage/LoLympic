"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Ban } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import TierBadge from "@/components/ui/TierBadge";
import RankCard from "@/components/ui/RankCard";
import BadgeShowcase from "@/components/ui/BadgeShowcase";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";

interface UserProfile {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  countryId?: string | null;
  createdAt: string;
  country?: {
    id: string;
    nameEn: string;
    flagEmoji: string;
  } | null;
  totalXp: number;
  level: number;
  tier: string;
  postKarma: number;
  commentKarma: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  badges: Array<{ badgeKey: string; earnedAt: string }>;
  posts: Array<{
    id: string;
    title: string;
    createdAt: string;
    images: Array<{ originalUrl: string }>;
    _count: { reactions: number; comments: number };
  }>;
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followPending, setFollowPending] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockPending, setBlockPending] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const postsSentinelRef = useRef<HTMLDivElement>(null);
  const postsPageRef = useRef(1);
  const postsHasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/users/${username}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setFollowing(data.isFollowing);
        setFollowerCount(data.followerCount);
        postsPageRef.current = 1;
        postsHasMoreRef.current = data.pagination?.hasMore ?? false;
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [username]);

  // Load more posts (infinite scroll)
  const loadMorePosts = useCallback(async () => {
    if (loadingMoreRef.current || !postsHasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMorePosts(true);
    const nextPage = postsPageRef.current + 1;
    try {
      const res = await fetch(`/api/users/${username}?page=${nextPage}&limit=20`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfile((prev) => prev ? { ...prev, posts: [...prev.posts, ...data.posts] } : prev);
      postsPageRef.current = nextPage;
      postsHasMoreRef.current = data.pagination?.hasMore ?? false;
    } catch {
      // silently fail
    } finally {
      loadingMoreRef.current = false;
      setLoadingMorePosts(false);
    }
  }, [username]);

  // IntersectionObserver for posts infinite scroll
  useEffect(() => {
    if (!postsSentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMorePosts();
      },
      { rootMargin: "200px" }
    );
    observer.observe(postsSentinelRef.current);
    return () => observer.disconnect();
  }, [loadMorePosts]);

  // Fetch block status
  useEffect(() => {
    if (!profile || profile.isOwnProfile || !session) return;
    fetch(`/api/block?userId=${profile.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setIsBlocked(data.isBlocked);
      })
      .catch(() => {});
  }, [profile, session]);

  const handleBlock = useCallback(async () => {
    if (!profile || blockPending) return;
    setBlockPending(true);
    try {
      const res = await fetch("/api/block", {
        method: isBlocked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });
      if (!res.ok) throw new Error();
      setIsBlocked(!isBlocked);
      if (!isBlocked) {
        // If blocking, also unfollow
        setFollowing(false);
        setFollowerCount((c) => following ? c - 1 : c);
      }
      toast(isBlocked ? t("block.userUnblocked") : t("block.userBlocked"), "success");
    } catch {
      toast("Failed to update block status", "error");
    } finally {
      setBlockPending(false);
      setShowBlockConfirm(false);
    }
  }, [profile, isBlocked, blockPending, following, toast, t]);

  const handleFollow = useCallback(async () => {
    if (!profile || followPending) return;
    const wasFollowing = following;

    // Optimistic update
    setFollowing(!wasFollowing);
    setFollowerCount((c) => wasFollowing ? c - 1 : c + 1);
    setFollowPending(true);

    try {
      const res = await fetch("/api/follow", {
        method: wasFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: profile.id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      setFollowing(wasFollowing);
      setFollowerCount((c) => wasFollowing ? c + 1 : c - 1);
      toast("Failed to update follow", "error");
    } finally {
      setFollowPending(false);
    }
  }, [profile, following, followPending, toast]);

  const handleDeletePost = useCallback(async () => {
    if (!deleteTarget || deletePending) return;
    setDeletePending(true);
    try {
      const res = await fetch(`/api/posts/${deleteTarget}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Post deleted", "success");
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.filter((p) => p.id !== deleteTarget),
          postCount: prev.postCount - 1,
        };
      });
    } catch {
      toast("Failed to delete post", "error");
    } finally {
      setDeletePending(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deletePending, toast]);

  if (loading) {
    return (
      <MainLayout showSidebar={false}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (error || !profile) {
    return (
      <MainLayout showSidebar={false}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-foreground-subtle text-sm">{t("profile.notFound")}</p>
        </div>
      </MainLayout>
    );
  }

  const tabs = [
    { id: "posts", label: t("profile.posts"), count: profile.postCount },
  ];

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <Avatar
              src={profile.avatarUrl}
              alt={profile.displayName || profile.username}
              size="xl"
              countryFlag={profile.country?.flagEmoji}
              tier={profile.tier}
            />
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-xl font-bold text-foreground">
                  {profile.displayName || profile.username}
                </h1>
                <TierBadge tier={profile.tier} level={profile.level} size="sm" />
                {profile.country && (
                  <span className="text-sm text-foreground-subtle">
                    {profile.country.flagEmoji} {profile.country.nameEn}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground-subtle mb-1">@{profile.username}</p>
              {profile.bio && (
                <p className="text-sm text-foreground-muted mb-3">{profile.bio}</p>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-4 text-xs text-foreground-subtle mb-3">
                <span suppressHydrationWarning>
                  {t("profile.joined", { date: new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) })}
                </span>
              </div>

              {/* Follow + Message buttons */}
              {!profile.isOwnProfile && session && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFollow}
                    disabled={followPending}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      following
                        ? "bg-background-overlay text-foreground-muted hover:text-red-400 hover:bg-red-500/10 border border-border-active"
                        : "bg-[#c9a84c] text-black hover:bg-[#b8963f]"
                    }`}
                  >
                    {following ? t("profile.following") : t("profile.follow")}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/conversations", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ participantId: profile.id }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          router.push(`/messages/${data.conversationId}`);
                        } else {
                          toast("Failed to start conversation", "error");
                        }
                      } catch {
                        toast("Failed to start conversation", "error");
                      }
                    }}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium bg-background-overlay text-foreground-muted hover:text-foreground border border-border-active transition-colors"
                  >
                    {t("profile.message")}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/user/${username}`);
                      toast("Profile link copied!", "success");
                    }}
                    className="p-1.5 rounded-lg bg-background-overlay text-foreground-muted hover:text-foreground border border-border-active transition-colors"
                    title="Share profile"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.757 8.813" />
                    </svg>
                  </button>
                  <button
                    onClick={() => isBlocked ? handleBlock() : setShowBlockConfirm(true)}
                    disabled={blockPending}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                      isBlocked
                        ? "bg-background-overlay text-foreground-muted hover:text-foreground border-border-active"
                        : "bg-transparent text-red-400 hover:bg-red-500/10 border-red-500/30 hover:border-red-500/50"
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {isBlocked ? t("block.unblock") : t("block.block")}
                  </button>
                </div>
              )}
              {profile.isOwnProfile && (
                <Link
                  href="/settings"
                  className="inline-block px-4 py-1.5 rounded-lg text-sm font-medium bg-background-overlay text-foreground-muted hover:text-foreground border border-border-active transition-colors"
                >
                  {t("profile.editProfile")}
                </Link>
              )}
            </div>
          </div>
        </Card>

        {/* Rank Card */}
        <RankCard totalXp={profile.totalXp} />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <div className="text-2xl font-bold text-foreground">{profile.postCount}</div>
            <div className="text-xs text-foreground-subtle">{t("profile.posts")}</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-foreground">{followerCount}</div>
            <div className="text-xs text-foreground-subtle">{t("profile.followers")}</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-foreground">{profile.followingCount}</div>
            <div className="text-xs text-foreground-subtle">{t("profile.following")}</div>
          </Card>
        </div>

        {/* Karma */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <div className="text-2xl font-bold text-foreground">{profile.postKarma ?? 0}</div>
            <div className="text-xs text-foreground-subtle">{t("karma.postKarma")}</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-bold text-foreground">{profile.commentKarma ?? 0}</div>
            <div className="text-xs text-foreground-subtle">{t("karma.commentKarma")}</div>
          </Card>
        </div>

        {/* Badges */}
        {profile.badges && profile.badges.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <span>🏅</span> Badges
            </h3>
            <BadgeShowcase badges={profile.badges} />
          </Card>
        )}

        {/* Tabs */}
        <Tabs tabs={tabs} defaultTab="posts" onChange={setActiveTab} />

        <div className="pb-16">
          {activeTab === "posts" && (
            <div>
              {profile.posts.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {profile.posts.map((post) => (
                      <div key={post.id} className="group relative">
                        <Link href={`/post/${post.id}`}>
                          <div className="aspect-square rounded-xl overflow-hidden bg-background-elevated border border-border group-hover:border-border-active transition-colors">
                            {post.images[0] ? (
                              <img
                                src={post.images[0].originalUrl}
                                alt={post.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-foreground-subtle">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="mt-1.5 px-0.5">
                            <p className="text-xs text-foreground-muted truncate">{post.title}</p>
                            <div className="flex items-center gap-2 text-[10px] text-foreground-subtle">
                              <span>{post._count.reactions} reactions</span>
                              <span>{post._count.comments} comments</span>
                            </div>
                          </div>
                        </Link>
                        {profile.isOwnProfile && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteTarget(post.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-red-400 hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200"
                            title="Delete post"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Infinite scroll sentinel + loader */}
                  <div ref={postsSentinelRef} className="h-1" />
                  {loadingMorePosts && (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-sm text-foreground-subtle">{t("profile.noPosts")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Block confirmation dialog */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={() => setShowBlockConfirm(false)}>
          <div className="bg-background-surface border border-border rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground mb-2">{t("block.confirmTitle")}</h3>
            <p className="text-sm text-foreground-muted mb-4">{t("block.confirmMessage")}</p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-foreground-muted border border-border hover:bg-background-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={blockPending}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {blockPending ? "..." : t("block.block")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-background-surface border border-border rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground mb-2">Delete Post</h3>
            <p className="text-sm text-foreground-muted mb-4">Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-foreground-muted border border-border hover:bg-background-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deletePending}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletePending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
