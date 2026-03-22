"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useTranslation } from "@/i18n";
import Link from "next/link";

const LANGUAGES = [
  { code: "ko", label: "한국어", icon: "한" },
  { code: "en", label: "English", icon: "A" },
  { code: "ja", label: "日本語", icon: "あ" },
  { code: "zh", label: "中文", icon: "字" },
  { code: "es", label: "Español", icon: "Ñ" },
  { code: "hi", label: "हिन्दी", icon: "अ" },
  { code: "ar", label: "العربية", icon: "ع" },
];

const COUNTRIES = [
  { code: "KR", label: "South Korea", flag: "\u{1F1F0}\u{1F1F7}" },
  { code: "US", label: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "GB", label: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "AU", label: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
  { code: "CA", label: "Canada", flag: "\u{1F1E8}\u{1F1E6}" },
  { code: "JP", label: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
  { code: "CN", label: "China", flag: "\u{1F1E8}\u{1F1F3}" },
  { code: "TW", label: "Taiwan", flag: "\u{1F1F9}\u{1F1FC}" },
  { code: "HK", label: "Hong Kong", flag: "\u{1F1ED}\u{1F1F0}" },
  { code: "MX", label: "Mexico", flag: "\u{1F1F2}\u{1F1FD}" },
  { code: "ES", label: "Spain", flag: "\u{1F1EA}\u{1F1F8}" },
  { code: "AR", label: "Argentina", flag: "\u{1F1E6}\u{1F1F7}" },
  { code: "CO", label: "Colombia", flag: "\u{1F1E8}\u{1F1F4}" },
  { code: "CL", label: "Chile", flag: "\u{1F1E8}\u{1F1F1}" },
  { code: "IN", label: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "SA", label: "Saudi Arabia", flag: "\u{1F1F8}\u{1F1E6}" },
  { code: "EG", label: "Egypt", flag: "\u{1F1EA}\u{1F1EC}" },
  { code: "AE", label: "UAE", flag: "\u{1F1E6}\u{1F1EA}" },
];

type SettingsTab = "profile" | "account" | "notifications" | "language" | "about";

const TAB_ICONS: Record<SettingsTab, string> = {
  profile: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  account: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  notifications: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  language: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129",
  about: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

const TAB_IDS: SettingsTab[] = ["profile", "account", "notifications", "language", "about"];

const TAB_LABEL_KEYS: Record<SettingsTab, string> = {
  profile: "settings.profile",
  account: "settings.account",
  notifications: "settings.notifications",
  language: "settings.language",
  about: "settings.about",
};

export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { t, setLocale } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("KR");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Notification state
  const [notifReactions, setNotifReactions] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);
  const [notifSuggestions, setNotifSuggestions] = useState(true);
  const [notifSeason, setNotifSeason] = useState(true);

  // Language state
  const [uiLanguage, setUiLanguage] = useState("en");
  const [preferredLang, setPreferredLang] = useState("ko");
  const [autoTranslate, setAutoTranslate] = useState(true);

  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch real profile data on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    setProfileLoading(true);
    fetch("/api/users/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setDisplayName(data.displayName || "");
          setBio(data.bio || "");
          setCountry(data.countryId || "KR");
          setAvatarUrl(data.avatarUrl || null);
          setPreferredLang(data.preferredLanguage || "ko");
          setUiLanguage(data.uiLanguage || "en");
          setHasPassword(!!data.hasPassword);
          setEmailVerified(!!data.emailVerified);
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [status]);

  if (status === "loading") {
    return (
      <MainLayout showSidebar={false}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-[#c9a84c] animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please select an image file", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be under 5MB", "error");
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAvatarUrl(data.url);
      toast("Avatar uploaded!", "success");
    } catch {
      toast("Failed to upload avatar", "error");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};

      if (activeTab === "profile") {
        payload.displayName = displayName;
        payload.bio = bio;
        payload.countryId = country;
        payload.avatarUrl = avatarUrl;
      } else if (activeTab === "language") {
        payload.uiLanguage = uiLanguage;
        payload.preferredLanguage = preferredLang;
        // Update the i18n locale so the UI re-renders in the new language
        setLocale(uiLanguage as any);
      } else if (activeTab === "notifications") {
        // Notification preferences are stored locally for now
        localStorage.setItem("lolympic_notif_prefs", JSON.stringify({
          notifReactions, notifComments, notifFollows, notifSuggestions, notifSeason,
        }));
        toast(t("settings.saved"), "success");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      // Refresh session to pick up updated values
      await updateSession();
      // Also store preferredLanguage in localStorage for immediate availability
      if (activeTab === "language") {
        localStorage.setItem("lolympic_preferredLanguage", preferredLang);
      }
      toast(t("settings.saved"), "success");
    } catch (err: any) {
      toast(err.message || t("settings.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-4xl mx-auto py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">{t("settings.title")}</h1>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar tabs */}
          <nav className="space-y-1">
            {TAB_IDS.map((tabId) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tabId
                    ? "bg-[#c9a84c]/10 text-[#c9a84c]"
                    : "text-foreground-muted hover:text-foreground hover:bg-background-elevated"
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={TAB_ICONS[tabId]} />
                </svg>
                {t(TAB_LABEL_KEYS[tabId] as any)}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="space-y-6">
            {/* Profile */}
            {activeTab === "profile" && (
              <div className="bg-background-surface border border-border rounded-xl p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground">{t("settings.profileSettings")}</h2>

                {profileLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Avatar upload */}
                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <Avatar
                          src={avatarUrl}
                          alt={displayName || (session.user as any)?.username || "User"}
                          size="xl"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="absolute inset-0 rounded-full bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          {avatarUploading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">{t("settings.profilePhoto")}</p>
                        <p className="text-xs text-foreground-subtle">{t("settings.changePhoto")}. Max 5MB.</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-1.5">{t("settings.displayName")}</label>
                      <input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                        maxLength={50}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-1.5">{t("settings.bio")}</label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors resize-none"
                        rows={3}
                        maxLength={200}
                      />
                      <p className="text-[10px] text-foreground-subtle mt-1">{bio.length}/200</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground-muted mb-1.5">{t("settings.country")}</label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <Button onClick={handleSave} loading={saving}>
                        {saving ? t("settings.saving") : t("settings.saveChanges")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Account */}
            {activeTab === "account" && (
              <div className="space-y-4">
                {/* Theme / Appearance */}
                <div className="bg-background-surface border border-border rounded-xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{t("settings.appearance")}</h2>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{t("settings.darkMode")}</p>
                      <p className="text-xs text-foreground-subtle">
                        {theme === "dark" ? "Dark theme is active" : "Light theme is active"}
                      </p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        theme === "dark" ? "bg-[#c9a84c]" : "bg-border-active"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          theme === "dark" ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="bg-background-surface border border-border rounded-xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{t("settings.accountInfo")}</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-foreground-muted">{t("settings.email")}</span>
                      <span className="text-sm text-foreground">{(session.user as any).email || "\u2014"}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-foreground-muted">{t("settings.username")}</span>
                      <span className="text-sm text-foreground">@{(session.user as any).username || "\u2014"}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-sm text-foreground-muted">{t("settings.role")}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#c9a84c]/10 text-[#c9a84c]">
                        {(session.user as any).role || "USER"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-foreground-muted">Login Provider</span>
                      <span className="text-sm text-foreground">Credentials</span>
                    </div>
                  </div>
                </div>

                {!emailVerified && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-500">Email not verified</p>
                      <p className="text-xs text-foreground-subtle">Email verification is not yet available. This does not affect your account functionality.</p>
                    </div>
                  </div>
                )}

                <div className="bg-background-surface border border-border rounded-xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">{t("settings.password")}</h2>
                  {hasPassword ? (
                    <>
                      <p className="text-sm text-foreground-subtle">Change your password to keep your account secure.</p>
                      <div className="space-y-3">
                        <input
                          type="password"
                          placeholder="Current password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                        />
                        <input
                          type="password"
                          placeholder="New password (min 6 characters)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                        />
                        <input
                          type="password"
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                        />
                      </div>
                      <Button
                        loading={passwordSaving}
                        disabled={!currentPassword || !newPassword || !confirmPassword}
                        onClick={async () => {
                          if (newPassword !== confirmPassword) {
                            toast("Passwords do not match", "error");
                            return;
                          }
                          if (newPassword.length < 6) {
                            toast("New password must be at least 6 characters", "error");
                            return;
                          }
                          setPasswordSaving(true);
                          try {
                            const res = await fetch("/api/auth/change-password", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ currentPassword, newPassword }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Failed to change password");
                            toast("Password changed successfully", "success");
                            setCurrentPassword("");
                            setNewPassword("");
                            setConfirmPassword("");
                          } catch (err: any) {
                            toast(err.message || "Failed to change password", "error");
                          } finally {
                            setPasswordSaving(false);
                          }
                        }}
                      >
                        {passwordSaving ? "Changing..." : "Change Password"}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-foreground-subtle">
                      Password change is not available for OAuth accounts. You signed in with Google.
                    </p>
                  )}
                </div>

                <div className="bg-background-surface border border-red-500/20 rounded-xl p-6 space-y-3">
                  <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
                  <p className="text-sm text-foreground-subtle">
                    Once you delete your account, there is no going back. All your posts, translations, and achievements will be permanently removed.
                  </p>
                  {!showDeleteConfirm ? (
                    <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>Delete Account</Button>
                  ) : (
                    <div className="space-y-3 border-t border-red-500/20 pt-3">
                      <p className="text-sm text-red-400 font-medium">Are you sure? This action is irreversible.</p>
                      {hasPassword && (
                        <input
                          type="password"
                          placeholder="Enter your password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          className="w-full bg-background-elevated border border-red-500/30 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-red-500/50 transition-colors"
                        />
                      )}
                      <input
                        type="text"
                        placeholder='Type "DELETE" to confirm'
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        className="w-full bg-background-elevated border border-red-500/30 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          loading={deleteLoading}
                          disabled={deleteConfirmation !== "DELETE" || (hasPassword && !deletePassword)}
                          onClick={async () => {
                            setDeleteLoading(true);
                            try {
                              const res = await fetch("/api/auth/delete-account", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  password: deletePassword || undefined,
                                  confirmation: deleteConfirmation,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || "Failed to delete account");
                              await signOut({ callbackUrl: "/" });
                            } catch (err: any) {
                              toast(err.message || "Failed to delete account", "error");
                              setDeleteLoading(false);
                            }
                          }}
                        >
                          {deleteLoading ? "Deleting..." : "Permanently Delete"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeletePassword("");
                            setDeleteConfirmation("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notifications */}
            {activeTab === "notifications" && (
              <div className="bg-background-surface border border-border rounded-xl p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground">{t("settings.notifPrefs")}</h2>
                <p className="text-sm text-foreground-subtle">Choose what notifications you want to receive.</p>

                <div className="space-y-4">
                  <ToggleRow label={t("settings.notifReactions")} description="When someone reacts to your meme" checked={notifReactions} onChange={setNotifReactions} />
                  <ToggleRow label={t("settings.notifComments")} description="When someone comments on your meme" checked={notifComments} onChange={setNotifComments} />
                  <ToggleRow label={t("settings.notifFollowers")} description="When someone follows you" checked={notifFollows} onChange={setNotifFollows} />
                  <ToggleRow label={t("settings.notifSuggestions")} description="When someone suggests a better translation" checked={notifSuggestions} onChange={setNotifSuggestions} />
                  <ToggleRow label={t("settings.notifSeason")} description="Season start, end, and medal announcements" checked={notifSeason} onChange={setNotifSeason} />

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-foreground">{t("settings.notifEmail")}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground-subtle/20 text-foreground-subtle">Coming soon</span>
                        </div>
                        <p className="text-xs text-foreground-subtle">Email notifications coming soon. An email service is required.</p>
                      </div>
                      <button
                        disabled
                        className="relative w-10 h-5 rounded-full bg-[#333] opacity-50 cursor-not-allowed"
                      >
                        <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white" />
                      </button>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSave} loading={saving}>
                  {t("settings.savePrefs")}
                </Button>
              </div>
            )}

            {/* Language */}
            {activeTab === "language" && (
              <div className="bg-background-surface border border-border rounded-xl p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground">{t("settings.langTranslation")}</h2>

                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1.5">{t("settings.interfaceLang")}</label>
                  <select
                    value={uiLanguage}
                    onChange={(e) => setUiLanguage(e.target.value)}
                    className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.icon} {l.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-foreground-subtle mt-1">{t("settings.interfaceLangDesc")}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1.5">{t("settings.preferredLang")}</label>
                  <select
                    value={preferredLang}
                    onChange={(e) => setPreferredLang(e.target.value)}
                    className="w-full bg-background-elevated border border-border-hover rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.icon} {l.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-foreground-subtle mt-1">{t("settings.preferredLangDesc")}</p>
                </div>

                <ToggleRow
                  label={t("settings.autoTranslation")}
                  description={t("settings.autoTranslationDesc")}
                  checked={autoTranslate}
                  onChange={setAutoTranslate}
                />

                <Button onClick={handleSave} loading={saving}>
                  {t("settings.savePrefs")}
                </Button>
              </div>
            )}

            {/* About */}
            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="bg-background-surface border border-border rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold">
                      <span className="text-[#c9a84c]">LoL</span>
                      <span className="text-foreground">ympic</span>
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-background-elevated text-foreground-subtle">v0.1.0 Beta</span>
                  </div>
                  <p className="text-sm text-foreground-muted leading-relaxed">
                    {t("settings.aboutDesc")}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-background-elevated rounded-lg p-3">
                      <span className="text-foreground-subtle">Languages</span>
                      <p className="text-foreground font-medium">7 supported</p>
                    </div>
                    <div className="bg-background-elevated rounded-lg p-3">
                      <span className="text-foreground-subtle">Countries</span>
                      <p className="text-foreground font-medium">{COUNTRIES.length} countries</p>
                    </div>
                    <div className="bg-background-elevated rounded-lg p-3">
                      <span className="text-foreground-subtle">Translation AI</span>
                      <p className="text-foreground font-medium">Google Gemini</p>
                    </div>
                    <div className="bg-background-elevated rounded-lg p-3">
                      <span className="text-foreground-subtle">Season Length</span>
                      <p className="text-foreground font-medium">7 days</p>
                    </div>
                  </div>
                </div>

                <div className="bg-background-surface border border-border rounded-xl p-6 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Links</h3>
                  <div className="space-y-2">
                    <Link href="/rules" className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background-elevated transition-colors group">
                      <span className="text-sm text-foreground-muted group-hover:text-foreground">Community Rules</span>
                      <svg className="w-4 h-4 text-foreground-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    <Link href="/terms" className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background-elevated transition-colors group">
                      <span className="text-sm text-foreground-muted group-hover:text-foreground">Terms of Service</span>
                      <svg className="w-4 h-4 text-foreground-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    <Link href="/terms#privacy" className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background-elevated transition-colors group">
                      <span className="text-sm text-foreground-muted group-hover:text-foreground">Privacy Policy</span>
                      <svg className="w-4 h-4 text-foreground-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    <Link href="/terms#copyright" className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background-elevated transition-colors group">
                      <span className="text-sm text-foreground-muted group-hover:text-foreground">Copyright & DMCA</span>
                      <svg className="w-4 h-4 text-foreground-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>

                <div className="text-center py-4">
                  <p className="text-xs text-foreground-subtle">
                    Made with memes and AI. &copy; 2026 LoLympic. All rights reserved.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-xs text-foreground-subtle">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? "bg-[#c9a84c]" : "bg-[#333]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
