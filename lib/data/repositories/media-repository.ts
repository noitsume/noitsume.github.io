import type { Media } from "@/lib/data/contracts";

export interface MediaRepository {
  listByRoom(roomId: string): Promise<Media[]>;
  getById(id: string): Promise<Media | null>;
}
