"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface BoardPost {
  id: string;
  body: string;
  likeCount: number;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
}

export default function CountryBoardFeed({ countryId, userCountryId }: { countryId: string; userCountryId?: string }) {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canPost = session?.user && userCountryId === countryId;

  useEffect(() => {
    fetch(`/api/country-board?countryId=${countryId}`)
      .then((r) => r.json())
      .then((data) => setPosts(data.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [countryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/country-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryId, body }),
      });
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => [data.post, ...prev]);
        setBody("");
      }
    } catch {}
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/country-board/${id}`, { method: "DELETE" });
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-4">
      {canPost && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write something for your country..."
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background-surface text-sm resize-none focus:outline-none focus:border-[#c9a84c]/50"
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-foreground-subtle">{body.length}/500</span>
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="px-4 py-1.5 rounded-lg bg-[#c9a84c] text-black text-xs font-medium disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-background-surface rounded-xl animate-pulse" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-sm text-foreground-subtle">
          No posts yet. Be the first to post!
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="bg-background-surface rounded-xl p-3 border border-border">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-background-elevated flex items-center justify-center text-xs text-foreground-subtle overflow-hidden">
                  {p.author.avatarUrl ? (
                    <Image src={p.author.avatarUrl} alt="" width={24} height={24} className="object-cover" />
                  ) : (
                    (p.author.displayName || p.author.username)[0]?.toUpperCase()
                  )}
                </div>
                <span className="text-xs font-medium text-foreground-muted">{p.author.displayName || p.author.username}</span>
                <span className="text-[10px] text-foreground-subtle ml-auto">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
                {session?.user && (session.user as { username?: string }).username === p.author.username && (
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-[10px] text-red-400/60 hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-sm text-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
