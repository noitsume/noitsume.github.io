import type {
  CreateRoomInput,
  Room,
  UpdateRoomInput,
} from "@/lib/data/contracts";

export interface RoomRepository {
  listRooms(ownerUid: string): Promise<Room[]>;
  getRoom(id: string): Promise<Room | null>;
  createRoom(ownerUid: string, input: CreateRoomInput): Promise<Room>;
  updateRoom(id: string, patch: UpdateRoomInput): Promise<Room>;
  deleteRoom(id: string): Promise<void>;
  setPinned(id: string, pinned: boolean): Promise<Room>;
  touchLastOpened(id: string, openedAt?: string): Promise<Room>;
}
