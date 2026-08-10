import type { RoomMusic } from "@/lib/creative";

export interface RoomMusicRepository {
  listByRoom(roomId: string): Promise<RoomMusic[]>;
  getById(roomId: string, musicId: string): Promise<RoomMusic | null>;
  create(roomMusic: RoomMusic): Promise<"created" | "exists">;
  updateAnalysis(roomId: string, musicId: string, roomMusic: RoomMusic): Promise<void>;
  delete(roomId: string, musicId: string): Promise<void>;
}
