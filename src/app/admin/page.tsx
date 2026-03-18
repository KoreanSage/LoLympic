"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Stats {
  users: number;
  posts: number;
  translations: number;
  activeSeason: { id: string; name: string; status: string } | null;
  monthlyWinners: number;
}

interface UserRow {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  role: string;
  isChampion: boolean;
  createdAt: string;
  _count: { posts: number };
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  const isAdmin =
    (session?.user as any)?.role === "ADMIN" ||
    (session?.user as any)?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !isAdmin) {
      router.push("/");
      return;
    }
    loadData();
  }, [session, status]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  const handleCreateSeason = async () => {
    const year = new Date().getFullYear();
    const res = await fetch("/api/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, name: `Season ${year}` }),
    });
    const data = await res.json();
    if (res.ok) {
      setActionMsg(`Season created: ${data.season.name}`);
      loadData();
    } else {
      setActionMsg(`Error: ${data.error}`);
    }
  };

  const handleSelectMonthlyWinner = async () => {
    const res = await fetch("/api/seasons/monthly-winner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      setActionMsg(`Winner selected: ${data.winner.post.title}`);
      loadData();
    } else {
      setActionMsg(`Error: ${data.error}`);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    if (res.ok) {
      setActionMsg("Role updated");
      loadData();
    } else {
      const data = await res.json();
      setActionMsg(`Error: ${data.error}`);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              <span className="text-[#c9a84c]">LoL</span>ympic Admin
            </h1>
            <p className="text-sm text-foreground-subtle mt-1">Dashboard</p>
          </div>
          <a
            href="/"
            className="text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            ← Back to site
          </a>
        </div>

        {/* Action message */}
        {actionMsg && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-[#c9a84c]/10 border border-[#c9a84c]/30 text-sm text-[#c9a84c]">
            {actionMsg}
            <button
              onClick={() => setActionMsg("")}
              className="ml-3 text-foreground-subtle hover:text-foreground"
            >
              x
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Users" value={stats?.users ?? 0} />
          <StatCard label="Posts" value={stats?.posts ?? 0} />
          <StatCard label="Translations" value={stats?.translations ?? 0} />
          <StatCard
            label="Monthly Winners"
            value={stats?.monthlyWinners ?? 0}
          />
        </div>

        {/* Season Management */}
        <div className="bg-background-surface border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Season Management</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-sm text-foreground-muted">
              Active Season:{" "}
              <span className="text-foreground font-medium">
                {stats?.activeSeason?.name || "None"}
              </span>
              {stats?.activeSeason && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                  {stats.activeSeason.status}
                </span>
              )}
            </div>
            <button
              onClick={handleCreateSeason}
              className="px-4 py-2 rounded-lg bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#d4b85e] transition-colors"
            >
              Create {new Date().getFullYear()} Season
            </button>
            <button
              onClick={handleSelectMonthlyWinner}
              className="px-4 py-2 rounded-lg bg-background-elevated border border-border text-sm font-medium hover:border-[#c9a84c]/50 transition-colors"
            >
              Select Monthly Winner (Last Month)
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-background-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">
            Users ({users.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-foreground-subtle text-left">
                  <th className="pb-3 pr-4">User</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">Posts</th>
                  <th className="pb-3 pr-4">Champion</th>
                  <th className="pb-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/50 hover:bg-background-elevated/50"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-foreground">
                        {u.displayName || u.username}
                      </div>
                      <div className="text-xs text-foreground-subtle">
                        @{u.username}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-foreground-muted">
                      {u.email || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u.id, e.target.value)
                        }
                        className="bg-background-elevated border border-border rounded px-2 py-1 text-xs"
                      >
                        <option value="USER">USER</option>
                        <option value="MODERATOR">MODERATOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="py-3 pr-4 text-foreground-muted">
                      {u._count.posts}
                    </td>
                    <td className="py-3 pr-4">
                      {u.isChampion ? (
                        <span className="text-[#c9a84c]">🏆</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 text-foreground-subtle text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background-surface border border-border rounded-xl p-4">
      <p className="text-xs text-foreground-subtle mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
