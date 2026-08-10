import type {
  CreateRoomInput,
  Room,
  RoomStatus,
  UpdateRoomInput,
} from "@/lib/data/contracts";

export interface RoomRepository {
  listRooms(ownerUid: string): Promise<Room[]>;
  getRoom(id: string): Promise<Room | null>;
  getRoomByCollectorId(collectorId: string): Promise<Room | null>;
  createRoom(ownerUid: string, input: CreateRoomInput): Promise<Room>;
  updateRoom(id: string, patch: UpdateRoomInput, updatedAt: string): Promise<void>;
  deleteRoom(id: string): Promise<void>;
  setPinned(id: string, pinned: boolean, updatedAt: string): Promise<void>;
  setStatus(id: string, status: RoomStatus, updatedAt: string): Promise<void>;
  setConfig(id: string, config: Room["config"], updatedAt: string): Promise<void>;
  touchLastOpened(id: string, openedAt: string): Promise<void>;
}
