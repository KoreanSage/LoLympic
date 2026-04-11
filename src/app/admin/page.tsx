"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";

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
  isBanned: boolean;
  banReason: string | null;
  bannedUntil: string | null;
  createdAt: string;
  _count: { posts: number };
}

interface ReportRow {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; username: string; displayName: string | null } | null;
  post: { id: string; title: string } | null;
  comment: { id: string; body: string } | null;
  suggestionId: string | null;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("7");
  const [banPending, setBanPending] = useState(false);
  const [retranslateLangs, setRetranslateLangs] = useState<Record<string, boolean>>({ hi: true, ar: true });
  const [retranslateRunning, setRetranslateRunning] = useState(false);
  const [retranslateProgress, setRetranslateProgress] = useState<{
    phase: "deleting" | "translating" | "done";
    total: number;
    current: number;
    failed: number;
    deletedPayloads: number;
  } | null>(null);

  const isAdmin =
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "SUPER_ADMIN";

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

  const loadReports = async (page = 1, status = "") => {
    setReportsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setReportsTotal(data.pagination?.total ?? 0);
      }
    } catch {
      // ignore
    }
    setReportsLoading(false);
  };

  const handleReportAction = async (
    reportId: string,
    action: "dismiss" | "delete"
  ) => {
    const res = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId,
        status: action === "dismiss" ? "DISMISSED" : "RESOLVED",
        deleteContent: action === "delete",
      }),
    });
    if (res.ok) {
      setActionMsg(action === "dismiss" ? "Report dismissed" : "Content removed & report resolved");
      loadReports(reportsPage, reportFilter);
    } else {
      const data = await res.json();
      setActionMsg(`Error: ${data.error}`);
    }
  };

  const handleCreateSeason = async (isBeta = false) => {
    const year = new Date().getFullYear();
    const res = await fetch("/api/seasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year,
        isBeta,
        name: isBeta ? `Beta Season ${year}` : `Season ${year}`,
      }),
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

  const handleBan = async () => {
    if (!banTarget || !banReason.trim() || banPending) return;
    setBanPending(true);
    try {
      const durationDays = banDuration === "permanent" ? null : parseInt(banDuration, 10);
      const res = await fetch(`/api/admin/users/${banTarget.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason, durationDays }),
      });
      if (res.ok) {
        setActionMsg(`User @${banTarget.username} banned`);
        loadData();
      } else {
        const data = await res.json();
        setActionMsg(`Error: ${data.error}`);
      }
    } catch {
      setActionMsg("Failed to ban user");
    } finally {
      setBanPending(false);
      setBanTarget(null);
      setBanReason("");
      setBanDuration("7");
    }
  };

  const handleUnban = async (userId: string, username: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: "DELETE",
      });
      if (res.ok) {
        setActionMsg(`User @${username} unbanned`);
        loadData();
      } else {
        const data = await res.json();
        setActionMsg(`Error: ${data.error}`);
      }
    } catch {
      setActionMsg("Failed to unban user");
    }
  };

  const handleRetranslate = async () => {
    const selected = Object.entries(retranslateLangs)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (selected.length === 0) {
      setActionMsg("Select at least one language");
      return;
    }
    setRetranslateRunning(true);
    setRetranslateProgress({ phase: "deleting", total: 0, current: 0, failed: 0, deletedPayloads: 0 });
    setActionMsg("");

    try {
      // Phase 1: Delete existing translations
      const deleteRes = await fetch("/api/admin/retranslate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguages: selected }),
      });
      const deleteData = await deleteRes.json();
      if (!deleteRes.ok) {
        setActionMsg(`Delete failed: ${deleteData.error}`);
        setRetranslateRunning(false);
        setRetranslateProgress(null);
        return;
      }

      const posts: { id: string; sourceLanguage: string }[] = deleteData.posts || [];
      if (posts.length === 0) {
        setActionMsg("No posts to retranslate");
        setRetranslateRunning(false);
        setRetranslateProgress(null);
        return;
      }

      // Phase 2: Retranslate each post from browser (has auth cookies)
      setRetranslateProgress({
        phase: "translating",
        total: posts.length,
        current: 0,
        failed: 0,
        deletedPayloads: deleteData.deletedPayloads,
      });

      let done = 0;
      let failCount = 0;
      const BATCH = 3; // concurrent requests

      for (let i = 0; i < posts.length; i += BATCH) {
        const batch = posts.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((post) => {
            const targets = selected.filter((l) => l !== post.sourceLanguage);
            if (targets.length === 0) return Promise.resolve();
            return fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                postId: post.id,
                sourceLanguage: post.sourceLanguage,
                targetLanguages: targets,
              }),
            }).then((r) => {
              if (!r.ok) throw new Error(`${r.status}`);
            });
          })
        );
        for (const r of results) {
          done++;
          if (r.status === "rejected") failCount++;
        }
        setRetranslateProgress((prev) =>
          prev ? { ...prev, current: done, failed: failCount } : null
        );
        // Small delay between batches
        if (i + BATCH < posts.length) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      setRetranslateProgress((prev) =>
        prev ? { ...prev, phase: "done" } : null
      );
      setActionMsg(
        `Retranslation complete: ${done - failCount}/${posts.length} posts translated${failCount > 0 ? `, ${failCount} failed` : ""}`
      );
    } catch {
      setActionMsg("Retranslation request failed");
    }
    setRetranslateRunning(false);
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
              {t("admin.title")}
            </h1>
            <p className="text-sm text-foreground-subtle mt-1">{t("admin.dashboard")}</p>
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

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 border-b border-border">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-[#c9a84c] text-[#c9a84c]"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => {
              setActiveTab("reports");
              if (reports.length === 0) loadReports(1, reportFilter);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "reports"
                ? "border-[#c9a84c] text-[#c9a84c]"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            Reports
          </button>
        </div>

        {activeTab === "reports" && (
          <div className="bg-background-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Reports ({reportsTotal})
              </h2>
              <select
                value={reportFilter}
                onChange={(e) => {
                  setReportFilter(e.target.value);
                  setReportsPage(1);
                  loadReports(1, e.target.value);
                }}
                className="bg-background-elevated border border-border rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="REVIEWING">Reviewing</option>
                <option value="RESOLVED">Resolved</option>
                <option value="DISMISSED">Dismissed</option>
              </select>
            </div>

            {reportsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-foreground-subtle text-center py-12">
                No reports found.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-foreground-subtle text-left">
                        <th className="pb-3 pr-4">Target</th>
                        <th className="pb-3 pr-4">Reason</th>
                        <th className="pb-3 pr-4">Reporter</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-border/50 hover:bg-background-elevated/50"
                        >
                          <td className="py-3 pr-4">
                            {r.post ? (
                              <div>
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 mr-1">
                                  POST
                                </span>
                                <span className="text-xs text-foreground truncate">
                                  {r.post.title?.slice(0, 30) || r.post.id}
                                </span>
                              </div>
                            ) : r.comment ? (
                              <div>
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 mr-1">
                                  COMMENT
                                </span>
                                <span className="text-xs text-foreground truncate">
                                  {r.comment.body?.slice(0, 30)}
                                </span>
                              </div>
                            ) : r.suggestionId ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400">
                                SUGGESTION
                              </span>
                            ) : (
                              <span className="text-xs text-foreground-subtle">Unknown</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-foreground-muted text-xs max-w-[200px]">
                            <div className="font-medium">{r.reason}</div>
                            {r.detail && (
                              <div className="text-foreground-subtle truncate">{r.detail}</div>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-foreground-muted text-xs">
                            {r.reporter
                              ? `@${r.reporter.username}`
                              : "Anonymous"}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                r.status === "PENDING"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : r.status === "REVIEWING"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : r.status === "RESOLVED"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-foreground-subtle/20 text-foreground-subtle"
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-foreground-subtle text-xs">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3">
                            {r.status === "PENDING" || r.status === "REVIEWING" ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleReportAction(r.id, "dismiss")}
                                  className="px-2 py-1 rounded text-xs bg-background-elevated border border-border hover:border-foreground-subtle transition-colors"
                                >
                                  Dismiss
                                </button>
                                {(r.post || r.comment) && (
                                  <button
                                    onClick={() => handleReportAction(r.id, "delete")}
                                    className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-foreground-subtle">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {reportsTotal > 20 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border">
                    <button
                      disabled={reportsPage <= 1}
                      onClick={() => {
                        const p = reportsPage - 1;
                        setReportsPage(p);
                        loadReports(p, reportFilter);
                      }}
                      className="px-3 py-1 rounded text-xs border border-border hover:bg-background-elevated disabled:opacity-40 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-foreground-muted">
                      Page {reportsPage} of {Math.ceil(reportsTotal / 20)}
                    </span>
                    <button
                      disabled={reportsPage >= Math.ceil(reportsTotal / 20)}
                      onClick={() => {
                        const p = reportsPage + 1;
                        setReportsPage(p);
                        loadReports(p, reportFilter);
                      }}
                      className="px-3 py-1 rounded text-xs border border-border hover:bg-background-elevated disabled:opacity-40 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "overview" && <>
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label={t("admin.users")} value={stats?.users ?? 0} />
          <StatCard label={t("admin.posts")} value={stats?.posts ?? 0} />
          <StatCard label={t("admin.translations")} value={stats?.translations ?? 0} />
          <StatCard
            label={t("admin.monthlyWinners")}
            value={stats?.monthlyWinners ?? 0}
          />
        </div>

        {/* Season Management */}
        <div className="bg-background-surface border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">{t("admin.seasonManagement")}</h2>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-sm text-foreground-muted">
              {t("admin.activeSeason")}:{" "}
              <span className="text-foreground font-medium">
                {stats?.activeSeason?.name || t("admin.noActiveSeason")}
              </span>
              {stats?.activeSeason && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                  {stats.activeSeason.status}
                </span>
              )}
            </div>
            <button
              onClick={() => handleCreateSeason(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              {t("admin.createBetaSeason")}
            </button>
            <button
              onClick={() => handleCreateSeason(false)}
              className="px-4 py-2 rounded-lg bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#d4b85e] transition-colors"
            >
              {t("admin.createSeason", { year: String(new Date().getFullYear()) })}
            </button>
            <button
              onClick={handleSelectMonthlyWinner}
              className="px-4 py-2 rounded-lg bg-background-elevated border border-border text-sm font-medium hover:border-[#c9a84c]/50 transition-colors"
            >
              {t("admin.selectMonthlyWinner")}
            </button>
          </div>
        </div>

        {/* Retranslate Section */}
        <div className="bg-background-surface border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-1">Retranslate</h2>
          <p className="text-xs text-foreground-subtle mb-4">
            Delete existing translations for selected languages and retranslate all posts with updated prompts.
          </p>
          <div className="flex items-center gap-4 flex-wrap mb-4">
            {[
              { code: "hi", label: "Hinglish" },
              { code: "ar", label: "Arabic" },
              { code: "ko", label: "Korean" },
              { code: "en", label: "English" },
              { code: "ja", label: "Japanese" },
              { code: "zh", label: "Chinese" },
              { code: "es", label: "Spanish" },
            ].map(({ code, label }) => (
              <label key={code} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={retranslateLangs[code] || false}
                  onChange={(e) =>
                    setRetranslateLangs((prev) => ({ ...prev, [code]: e.target.checked }))
                  }
                  className="accent-[#c9a84c] w-3.5 h-3.5"
                />
                <span className="text-foreground-muted">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleRetranslate}
              disabled={retranslateRunning}
              className="px-4 py-2 rounded-lg bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#d4b85e] transition-colors disabled:opacity-50"
            >
              {retranslateRunning ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  {retranslateProgress?.phase === "deleting"
                    ? "Deleting old translations..."
                    : retranslateProgress?.phase === "translating"
                    ? `Translating ${retranslateProgress.current}/${retranslateProgress.total}...`
                    : "Retranslating..."}
                </span>
              ) : (
                "Retranslate Selected"
              )}
            </button>
            {retranslateProgress && retranslateProgress.phase !== "deleting" && (
              <div className="text-xs text-foreground-muted">
                {retranslateProgress.deletedPayloads} deleted
                {retranslateProgress.phase === "done" && (
                  <>
                    {" / "}
                    {retranslateProgress.current - retranslateProgress.failed} retranslated
                    {retranslateProgress.failed > 0 && (
                      <span className="text-red-400"> / {retranslateProgress.failed} failed</span>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          {retranslateProgress?.phase === "translating" && (
            <div className="mt-3 w-full bg-background-elevated rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-[#c9a84c] transition-all duration-300"
                style={{ width: `${Math.round((retranslateProgress.current / retranslateProgress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-background-surface border border-border rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">
            {t("admin.users")} ({users.length})
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
                  <th className="pb-3 pr-4">Status</th>
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
                    <td className="py-3 pr-4">
                      {u.isBanned ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
                            BANNED
                          </span>
                          <button
                            onClick={() => handleUnban(u.id, u.username)}
                            className="px-2 py-0.5 rounded text-[10px] bg-background-elevated border border-border hover:border-foreground-subtle transition-colors"
                          >
                            Unban
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setBanTarget(u);
                            setBanReason("");
                            setBanDuration("7");
                          }}
                          className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          Ban
                        </button>
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
        </>}

        {/* Ban Modal */}
        {banTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={() => setBanTarget(null)}>
            <div className="bg-background-surface border border-border rounded-xl p-6 mx-4 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Ban @{banTarget.username}
              </h3>
              <p className="text-sm text-foreground-muted mb-4">
                {banTarget.displayName || banTarget.username}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    {t("ban.reason")} *
                  </label>
                  <input
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Enter ban reason..."
                    className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    {t("ban.duration")}
                  </label>
                  <select
                    value={banDuration}
                    onChange={(e) => setBanDuration(e.target.value)}
                    className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                  >
                    <option value="1">1{t("ban.days", { count: "1" }).replace("1", "").trim() || " day"}</option>
                    <option value="7">7{t("ban.days", { count: "7" }).replace("7", "").trim() || " days"}</option>
                    <option value="30">30{t("ban.days", { count: "30" }).replace("30", "").trim() || " days"}</option>
                    <option value="permanent">{t("ban.permanent")}</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end mt-5">
                <button
                  onClick={() => setBanTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-foreground-muted border border-border hover:bg-background-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBan}
                  disabled={!banReason.trim() || banPending}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {banPending ? "Banning..." : "Ban User"}
                </button>
              </div>
            </div>
          </div>
        )}
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
