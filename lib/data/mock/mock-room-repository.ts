import type {
  CreateRoomInput,
  Room,
  UpdateRoomInput,
} from "@/lib/data/contracts";
import type { RoomRepository } from "@/lib/data/repositories";
import { createId } from "@/lib/utils/id";
import { createMockRooms } from "./seed";

export class MockRoomRepository implements RoomRepository {
  private rooms: Room[];

  constructor(initialRooms: Room[] = createMockRooms()) {
    this.rooms = structuredClone(initialRooms);
  }

  async listRooms(ownerUid: string): Promise<Room[]> {
    return structuredClone(this.rooms.filter((room) => room.ownerUid === ownerUid));
  }

  async getRoom(id: string): Promise<Room | null> {
    const room = this.rooms.find((candidate) => candidate.id === id);
    return room ? structuredClone(room) : null;
  }

  async createRoom(ownerUid: string, input: CreateRoomInput): Promise<Room> {
    const now = new Date().toISOString();
    const room: Room = {
      ...input,
      id: createId("room"),
      ownerUid,
      collectorId: createId("collector"),
      receiverId: null,
      firstBakedAt: null,
      isPinned: false,
      lastOpenedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.rooms.push(room);
    return structuredClone(room);
  }

  async updateRoom(id: string, patch: UpdateRoomInput): Promise<Room> {
    return this.updateExisting(id, (room) => ({
      ...room,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  }

  async deleteRoom(id: string): Promise<void> {
    const before = this.rooms.length;
    this.rooms = this.rooms.filter((room) => room.id !== id);
    if (this.rooms.length === before) {
      throw new Error(`Room not found: ${id}`);
    }
  }

  async setPinned(id: string, pinned: boolean): Promise<Room> {
    return this.updateExisting(id, (room) => ({
      ...room,
      isPinned: pinned,
      updatedAt: new Date().toISOString(),
    }));
  }

  async touchLastOpened(id: string, openedAt = new Date().toISOString()): Promise<Room> {
    return this.updateExisting(id, (room) => ({
      ...room,
      lastOpenedAt: openedAt,
      updatedAt: openedAt,
    }));
  }

  private updateExisting(id: string, updater: (room: Room) => Room): Room {
    const index = this.rooms.findIndex((room) => room.id === id);
    if (index < 0) {
      throw new Error(`Room not found: ${id}`);
    }

    const updated = updater(this.rooms[index]);
    this.rooms[index] = updated;
    return structuredClone(updated);
  }
}
