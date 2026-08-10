import type { Media } from "@/lib/data/contracts";

export type MediaCreateManyResult = "created" | "exists";

export interface MediaRepository {
  listByRoom(roomId: string): Promise<Media[]>;
  getById(roomId: string, id: string): Promise<Media | null>;
  createMany(media: Media[]): Promise<MediaCreateManyResult>;
  updateStorageObjectKeys(updates: Array<{ roomId: string; mediaId: string; storageObjectKey: string }>): Promise<void>;
  updateAnalysis(roomId: string, mediaId: string, media: Media): Promise<void>;
  deleteMany(roomId: string, mediaIds: string[]): Promise<void>;
}
