"use client";

import {
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
  ensureCacheStorage();
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(stableRequest(cacheKey));
  if (response) void touchCacheEntry(cacheKey);
  return response ?? null;
}

export async function fetchAndCacheResource(input: CacheResourceInput) {
  ensureCacheStorage();

  const cached = await getCachedResource(input.cacheKey);
  if (cached) return { response: cached, source: "cache" as const };

  const networkResponse = await fetch(input.sourceUrl, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
  });

  if (!networkResponse.ok) {
    throw new Error(`Media fetch gagal (${networkResponse.status}).`);
  }

  const sizeBytes = Number(networkResponse.headers.get("content-length") || 0);
  const contentType = networkResponse.headers.get("content-type") || undefined;

  if (shouldPersistResource({ kind: input.kind, sizeBytes })) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(stableRequest(input.cacheKey), networkResponse.clone());

    const now = Date.now();
    await putCacheEntry({
      cacheKey: input.cacheKey,
      kind: input.kind,
      resourceId: input.resourceId,
      roomId: input.roomId,
      contentType,
      sizeBytes,
      cachedAt: now,
      lastAccessedAt: now,
      expiresAt: input.expiresAt,
      version: input.version ?? 1,
    });

    await enforceKenanginCacheBudget();
  }

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
