"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import MainLayout from "@/components/layout/MainLayout";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";
import Avatar from "@/components/ui/Avatar";

interface BoardPost {
  id: string;
  body: string;
  likeCount: number;
  createdAt: string;
  countryId: string;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  country?: { id: string; nameEn: string; flagEmoji: string };
}

interface CountryEntry {
  country: { id: string; nameEn: string; flagEmoji: string };
  totalCreators: number;
}

export default function CommunityPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [countries, setCountries] = useState<CountryEntry[]>([]);
  const [tab, setTab] = useState<"discussion" | "boards">("discussion");

  // Discussion state
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userCountryId, setUserCountryId] = useState<string | null>(null);
  const [userCountryFlag, setUserCountryFlag] = useState<string | null>(null);

  // Fetch user's country
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/users/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.countryId) {
          setUserCountryId(data.countryId);
          setUserCountryFlag(data.country?.flagEmoji || null);
        }
      })
      .catch(() => {});
  }, [session?.user]);

  // Fetch countries for boards tab
  useEffect(() => {
    fetch("/api/leaderboard?type=country&limit=20")
      .then((r) => r.json())
      .then((data) => setCountries(data.entries ?? []))
      .catch(() => {});
  }, []);

  // Fetch all discussion posts (global country board feed)
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/community");
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      console.error("Failed to fetch community posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Submit post
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || submitting || !userCountryId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/country-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryId: userCountryId, body: body.trim() }),
      });
      const data = await res.json();
      if (data.post) {
        // Add country info to the post for display
        const countryInfo = countries.find((c) => c.country.id === userCountryId);
        const enrichedPost = {
          ...data.post,
          country: countryInfo?.country || { id: userCountryId, nameEn: "", flagEmoji: userCountryFlag || "" },
        };
        setPosts((prev) => [enrichedPost, ...prev]);
        setBody("");
      }
    } catch {}
    setSubmitting(false);
  };

  // Delete post
  const handleDelete = async (id: string) => {
    await fetch(`/api/country-board/${id}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <MainLayout>
      <div className="space-y-4 py-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">{t("community.title")}</h1>
          <p className="text-sm text-foreground-subtle">{t("community.subtitle")}</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-background-surface rounded-lg p-0.5 border border-border mx-auto w-fit">
          <button
            onClick={() => setTab("discussion")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === "discussion"
                ? "bg-background-overlay text-foreground"
                : "text-foreground-subtle hover:text-foreground-muted"
            }`}
          >
            💬 {t("community.discussion")}
          </button>
          <button
            onClick={() => setTab("boards")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              tab === "boards"
                ? "bg-background-overlay text-foreground"
                : "text-foreground-subtle hover:text-foreground-muted"
            }`}
          >
            🌍 {t("community.countryBoards")}
          </button>
        </div>

        {/* Discussion tab */}
        {tab === "discussion" && (
          <div className="space-y-4">
            {/* Tab description */}
            <p className="text-xs text-foreground-subtle text-center">
              {t("community.discussionDesc")}
            </p>

            {/* Post composer */}
            {session?.user ? (
              userCountryId ? (
                <form onSubmit={handleSubmit} className="bg-background-surface border border-border rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={session.user.image || session.user.avatarUrl || null}
                      alt={session.user.name || ""}
                      size="sm"
                    />
                    <div className="flex-1">
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder={t("community.writePlaceholder")}
                        rows={2}
                        maxLength={500}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background-elevated text-sm resize-none focus:outline-none focus:border-[#c9a84c]/50 placeholder-foreground-subtle"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-foreground-subtle">
                          <span>{userCountryFlag}</span>
                          <span>{t("community.postingAs")}</span>
                          <span className="text-foreground-muted font-medium">{body.length}/500</span>
                        </div>
                        <button
                          type="submit"
                          disabled={!body.trim() || submitting}
                          className="px-4 py-1.5 rounded-lg bg-[#c9a84c] text-black text-xs font-medium disabled:opacity-40 hover:bg-[#b8963f] transition-colors"
                        >
                          {submitting ? t("common.loading") : t("community.post")}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="bg-background-surface border border-border rounded-xl p-4 text-center">
                  <p className="text-sm text-foreground-subtle">
                    {t("community.selectCountryFirst")}
                  </p>
                  <Link href="/settings" className="text-xs text-[#c9a84c] hover:underline mt-1 inline-block">
                    {t("nav.settings")} →
                  </Link>
                </div>
              )
            ) : (
              <div className="bg-background-surface border border-border rounded-xl p-4 text-center">
                <p className="text-sm text-foreground-subtle">{t("community.loginToPost")}</p>
                <Link href="/login" className="text-xs text-[#c9a84c] hover:underline mt-1 inline-block">
                  {t("nav.login")} →
                </Link>
              </div>
            )}

            {/* Posts feed */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-background-surface rounded-xl animate-pulse" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">💬</span>
                <h3 className="text-base font-bold text-foreground mb-1">{t("community.emptyDiscussion")}</h3>
                <p className="text-sm text-foreground-subtle max-w-sm">
                  {t("community.emptyDiscussionSubtext")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <div key={p.id} className="bg-background-surface rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-background-elevated flex items-center justify-center text-xs text-foreground-subtle overflow-hidden">
                        {p.author.avatarUrl ? (
                          <Image src={p.author.avatarUrl} alt="" width={28} height={28} className="object-cover w-full h-full" />
                        ) : (
                          (p.author.displayName || p.author.username)[0]?.toUpperCase()
                        )}
                      </div>
                      <Link href={`/user/${p.author.username}`} className="text-xs font-medium text-foreground-muted hover:text-foreground transition-colors">
                        {p.author.displayName || `@${p.author.username}`}
                      </Link>
                      {p.country && (
                        <Link href={`/country/${p.country.id}/board`} className="flex items-center gap-1 text-[10px] text-foreground-subtle hover:text-[#c9a84c] transition-colors">
                          <span>{p.country.flagEmoji}</span>
                          <span>{p.country.nameEn}</span>
                        </Link>
                      )}
                      <span className="text-[10px] text-foreground-subtle ml-auto">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                      {session?.user && (session.user as { username?: string }).username === p.author.username && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          {t("common.delete")}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{p.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Country boards tab */}
        {tab === "boards" && (
          <div className="space-y-3">
            {/* Tab description */}
            <p className="text-xs text-foreground-subtle text-center">
              {t("community.boardsDesc")}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {countries.map((entry) => (
                <Link
                  key={entry.country.id}
                  href={`/country/${entry.country.id}/board`}
                  className="flex flex-col items-center p-4 rounded-xl border border-border bg-background-surface hover:border-[#c9a84c]/40 hover:bg-[#c9a84c]/5 transition-all"
                >
                  <span className="text-3xl mb-2">{entry.country.flagEmoji}</span>
                  <span className="text-sm font-medium text-foreground text-center">{entry.country.nameEn}</span>
                  <span className="text-[10px] text-foreground-subtle mt-0.5">
                    {entry.totalCreators} {t("community.members")}
                  </span>
                </Link>
              ))}
              {countries.length === 0 && (
                <div className="col-span-full text-center py-12 text-sm text-foreground-subtle">
                  {t("community.noCountries")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
