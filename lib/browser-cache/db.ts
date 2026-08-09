"use client";

import type { BrowserCacheEntry } from "./types";

const DB_NAME = "kenangin-cache-index";
const DB_VERSION = 1;
const ENTRY_STORE = "entries";
const LAST_ACCESSED_INDEX = "lastAccessedAt";

function ensureIndexedDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB tidak tersedia di browser ini.");
  }
}

function requestAsPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request gagal."));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction gagal."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction dibatalkan."));
  });
}

export async function openCacheIndexDb() {
  ensureIndexedDb();

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) {
        const store = db.createObjectStore(ENTRY_STORE, { keyPath: "cacheKey" });
        store.createIndex(LAST_ACCESSED_INDEX, "lastAccessedAt");
        store.createIndex("expiresAt", "expiresAt");
        store.createIndex("roomId", "roomId");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB gagal dibuka."));
  });
}

export async function getCacheEntry(cacheKey: string) {
  const db = await openCacheIndexDb();
  try {
    const transaction = db.transaction(ENTRY_STORE, "readonly");
    const result = await requestAsPromise(
      transaction.objectStore(ENTRY_STORE).get(cacheKey),
    );
    return result as BrowserCacheEntry | undefined;
  } finally {
    db.close();
  }
}

export async function putCacheEntry(entry: BrowserCacheEntry) {
  const db = await openCacheIndexDb();
  try {
    const transaction = db.transaction(ENTRY_STORE, "readwrite");
    transaction.objectStore(ENTRY_STORE).put(entry);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function deleteCacheEntry(cacheKey: string) {
  const db = await openCacheIndexDb();
  try {
    const transaction = db.transaction(ENTRY_STORE, "readwrite");
    transaction.objectStore(ENTRY_STORE).delete(cacheKey);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function listCacheEntries(): Promise<BrowserCacheEntry[]> {
  const db = await openCacheIndexDb();
  try {
    const transaction = db.transaction(ENTRY_STORE, "readonly");
    const result = await requestAsPromise(
      transaction.objectStore(ENTRY_STORE).getAll(),
    );
    return result as BrowserCacheEntry[];
  } finally {
    db.close();
  }
}

export async function touchCacheEntry(cacheKey: string, now = Date.now()) {
  const existing = await getCacheEntry(cacheKey);
  if (!existing) return;
  await putCacheEntry({ ...existing, lastAccessedAt: now });
}
