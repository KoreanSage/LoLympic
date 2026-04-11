// ---------------------------------------------------------------------------
// Global translation tracker — stores post IDs that are currently being
// translated in localStorage so a floating indicator can follow the user
// across page navigations. Entries are auto-removed once translation
// completes (or after a 10-minute safety timeout).
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mimzy_translating_posts";
const MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes — safety cleanup

export interface TrackedPost {
  postId: string;
  title?: string;
  addedAt: number;
}

function readStore(): TrackedPost[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out stale entries
    const now = Date.now();
    return parsed.filter((e: TrackedPost) => e && e.postId && now - (e.addedAt || 0) < MAX_AGE_MS);
  } catch {
    return [];
  }
}

function writeStore(entries: TrackedPost[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    // Notify listeners in the same tab (storage event only fires cross-tab)
    window.dispatchEvent(new CustomEvent("mimzy:translation-tracker-changed"));
  } catch {
    // Swallow quota errors
  }
}

export function addTrackedPost(postId: string, title?: string): void {
  const existing = readStore();
  if (existing.some((e) => e.postId === postId)) return;
  existing.push({ postId, title, addedAt: Date.now() });
  writeStore(existing);
}

export function removeTrackedPost(postId: string): void {
  const existing = readStore();
  const next = existing.filter((e) => e.postId !== postId);
  if (next.length !== existing.length) writeStore(next);
}

export function getTrackedPosts(): TrackedPost[] {
  return readStore();
}

/**
 * Subscribe to tracker changes (both same-tab and cross-tab).
 * Returns an unsubscribe function.
 */
export function subscribeTracker(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener();
  };
  const customHandler = () => listener();
  window.addEventListener("storage", storageHandler);
  window.addEventListener("mimzy:translation-tracker-changed", customHandler);
  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener("mimzy:translation-tracker-changed", customHandler);
  };
}
