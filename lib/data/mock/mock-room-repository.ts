import type {
  CreateRoomInput,
  Room,
  RoomStatus,
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

  async getRoomByCollectorId(collectorId: string): Promise<Room | null> {
    const room = this.rooms.find((candidate) => candidate.collectorId === collectorId);
    return room ? structuredClone(room) : null;
  }

  async createRoom(ownerUid: string, input: CreateRoomInput): Promise<Room> {
    const now = new Date().toISOString();
    const room: Room = {
      ...input,
      id: createId("room"),
      ownerUid,
      status: "collecting",
      collectorId: createId("collector"),
      receiverId: null,
      config: null,
      firstBakedAt: null,
      lastBakedAt: null,
      isPinned: false,
      lastOpenedAt: null,
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    this.rooms.push(room);
    return structuredClone(room);
  }

  async updateRoom(
    id: string,
    patch: UpdateRoomInput,
    updatedAt: string,
  ): Promise<void> {
    this.updateExisting(id, (room) => ({
      ...room,
      ...patch,
      updatedAt,
    }));
  }

  async deleteRoom(id: string): Promise<void> {
    const before = this.rooms.length;
    this.rooms = this.rooms.filter((room) => room.id !== id);
    if (this.rooms.length === before) {
      throw new Error(`Room not found: ${id}`);
    }
  }

  async setPinned(
    id: string,
    pinned: boolean,
    updatedAt: string,
  ): Promise<void> {
    this.updateExisting(id, (room) => ({
      ...room,
      isPinned: pinned,
      updatedAt,
    }));
  }

  async setStatus(id: string, status: RoomStatus, updatedAt: string): Promise<void> {
    this.updateExisting(id, (room) => ({
      ...room,
      status,
      updatedAt,
    }));
  }

  async setConfig(id: string, config: Room["config"], updatedAt: string): Promise<void> {
    this.updateExisting(id, (room) => ({
      ...room,
      config,
      updatedAt,
    }));
  }

  async touchLastOpened(id: string, openedAt: string): Promise<void> {
    this.updateExisting(id, (room) => ({
      ...room,
      lastOpenedAt: openedAt,
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
