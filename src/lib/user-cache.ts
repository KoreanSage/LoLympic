"use client";

let cachedData: any = null;
let cachePromise: Promise<any> | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

export async function fetchCurrentUser(): Promise<any> {
  const now = Date.now();
  if (cachedData && now - cacheTime < CACHE_TTL) return cachedData;
  if (cachePromise) return cachePromise;
  cachePromise = fetch("/api/users/me")
    .then((r) => r.ok ? r.json() : null)
    .then((data) => { cachedData = data; cacheTime = Date.now(); cachePromise = null; return data; })
    .catch(() => { cachePromise = null; return null; });
  return cachePromise;
}

export function invalidateUserCache() { cachedData = null; cacheTime = 0; }
