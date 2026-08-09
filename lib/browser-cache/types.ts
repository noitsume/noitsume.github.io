export type BrowserCacheKind =
  | "photo"
  | "video"
  | "theme"
  | "ornament"
  | "aura"
  | "song"
  | "beatmap";

export type BrowserCacheEntry = {
  cacheKey: string;
  kind: BrowserCacheKind;
  resourceId: string;
  roomId?: string;
  contentType?: string;
  sizeBytes: number;
  cachedAt: number;
  lastAccessedAt: number;
  expiresAt?: number;
  version: number;
};

export type CacheResourceInput = {
  cacheKey: string;
  sourceUrl: string;
  kind: BrowserCacheKind;
  resourceId: string;
  roomId?: string;
  expiresAt?: number;
  version?: number;
};
