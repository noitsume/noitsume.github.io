"use client";

import {
  getCacheEntry,
  deleteCacheEntry,
  listCacheEntries,
  putCacheEntry,
  touchCacheEntry,
} from "./db";
import { getKenanginCacheBudgetBytes, shouldPersistResource } from "./policy";
import type { BrowserCacheEntry, CacheResourceInput } from "./types";

const CACHE_NAME = "kenangin-media-v1";
const STABLE_CACHE_PREFIX = "/__kenangin_cache__/";

function ensureCacheStorage() {
  if (typeof window === "undefined" || typeof caches === "undefined") {
    throw new Error("Cache Storage tidak tersedia di browser ini.");
  }
}

function normalizeCacheKey(cacheKey: string) {
  return cacheKey.replace(/^\/+/, "");
}

function stableRequest(cacheKey: string) {
  const path = `${STABLE_CACHE_PREFIX}${encodeURIComponent(normalizeCacheKey(cacheKey))}`;
  return new Request(new URL(path, window.location.origin), { method: "GET" });
}

export async function getCachedResource(cacheKey: string) {
  try {
    ensureCacheStorage();
    const entry = await getCacheEntry(cacheKey);
    if (!entry || (entry.expiresAt !== undefined && entry.expiresAt <= Date.now())) {
      await deleteCachedResource(cacheKey);
      return null;
    }
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(stableRequest(cacheKey));
    if (response) void touchCacheEntry(cacheKey).catch(() => undefined);
    return response ?? null;
  } catch { return null; }
}

export async function fetchAndCacheResource(input: CacheResourceInput) {
  const cached = await getCachedResource(input.cacheKey);
  if (cached) return { response: cached, source: "cache" as const };
  const networkResponse = await fetch(input.sourceUrl, { credentials: "omit", cache: "no-store" });
  if (!networkResponse.ok) throw new Error("Media belum dapat dimuat (" + networkResponse.status + ").");
  try {
    ensureCacheStorage();
    const declaredSize = Number(networkResponse.headers.get("content-length") ?? 0);
    // Unknown-size responses and large videos stay on the normal streaming path.
    if (declaredSize > 0 && declaredSize <= 25 * 1024 ** 2 && shouldPersistResource({ kind: input.kind, sizeBytes: declaredSize })) {
      const blob = await networkResponse.clone().blob();
      const sizeBytes = blob.size;
      const cache = await caches.open(CACHE_NAME);
      const response = new Response(blob, { headers: { "content-type": blob.type } });
      const now = Date.now();
      await evictExpiredResources(now);
      await cache.put(stableRequest(input.cacheKey), response);
      try {
        await putCacheEntry({ cacheKey: input.cacheKey, kind: input.kind, resourceId: input.resourceId, roomId: input.roomId, contentType: blob.type, sizeBytes, cachedAt: now, lastAccessedAt: now, expiresAt: input.expiresAt ?? now + 86400000, version: input.version ?? 1 });
        await enforceKenanginCacheBudget();
      } catch {
        await cache.delete(stableRequest(input.cacheKey));
      }
    }
  } catch { /* Denied storage or quota must never interrupt media playback. */ }
  return { response: networkResponse, source: "network" as const };
}

export async function deleteCachedResource(cacheKey: string) {
  ensureCacheStorage();
  const cache = await caches.open(CACHE_NAME);
  await Promise.all([
    cache.delete(stableRequest(cacheKey)),
    deleteCacheEntry(cacheKey),
  ]);
}

export async function evictExpiredResources(now = Date.now()) {
  const entries = await listCacheEntries();
  const expired = entries.filter(
    (entry) => entry.expiresAt !== undefined && entry.expiresAt <= now,
  );
  await Promise.all(expired.map((entry) => deleteCachedResource(entry.cacheKey)));
  return expired.length;
}

export async function enforceKenanginCacheBudget() {
  const [entries, budget] = await Promise.all([
    listCacheEntries(),
    getKenanginCacheBudgetBytes(),
  ]);

  let usage = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0);
  if (usage <= budget) return { evicted: 0, usageBytes: usage, budgetBytes: budget };

  const oldestFirst = [...entries].sort(
    (a, b) => a.lastAccessedAt - b.lastAccessedAt,
  );

  let evicted = 0;
  for (const entry of oldestFirst) {
    if (usage <= budget) break;
    await deleteCachedResource(entry.cacheKey);
    usage -= entry.sizeBytes;
    evicted += 1;
  }

  return { evicted, usageBytes: Math.max(usage, 0), budgetBytes: budget };
}

export async function getKenanginCacheEntries(): Promise<BrowserCacheEntry[]> {
  return listCacheEntries();
}
