"use client";

import type { BrowserCacheKind } from "./types";

export const KENANGIN_CACHE_LIMIT_BYTES = 500 * 1024 * 1024;
export const KENANGIN_CACHE_QUOTA_RATIO = 0.15;
export const KENANGIN_PERSISTENT_VIDEO_LIMIT_BYTES = 25 * 1024 * 1024;

export function shouldPersistResource(input: {
  kind: BrowserCacheKind;
  sizeBytes?: number;
}) {
  if (input.kind !== "video") return true;
  if (!input.sizeBytes) return false;
  return input.sizeBytes <= KENANGIN_PERSISTENT_VIDEO_LIMIT_BYTES;
}

export async function getKenanginCacheBudgetBytes() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return KENANGIN_CACHE_LIMIT_BYTES;
  }

  const estimate = await navigator.storage.estimate();
  if (!estimate.quota) return KENANGIN_CACHE_LIMIT_BYTES;

  return Math.min(
    KENANGIN_CACHE_LIMIT_BYTES,
    Math.floor(estimate.quota * KENANGIN_CACHE_QUOTA_RATIO),
  );
}

export async function requestPersistentKenanginStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  return navigator.storage.persist();
}
