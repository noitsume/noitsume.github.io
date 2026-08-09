import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import {
  roomSchema,
  type CreateRoomInput,
  type Room,
  type UpdateRoomInput,
} from "@/lib/data/contracts";
import type { RoomRepository } from "@/lib/data/repositories";
import { createId } from "@/lib/utils/id";
import {
  firestoreDb,
  nullableIsoString,
  toIsoString,
  toTimestamp,
} from "./shared";

function mapRoom(id: string, data: DocumentData): Room {
  return roomSchema.parse({
    id,
    ownerUid: data.ownerUid,
    title: data.title,
    recipientName: data.recipientName,
    occasionId: data.occasionId,
    eventId: data.eventId ?? null,
    themeId: data.themeId,
    customThemeNameRaw: data.customThemeNameRaw ?? null,
    status: data.status,
    collectorId: data.collectorId,
    receiverId: data.receiverId ?? null,
    collectionDeadline: toIsoString(data.collectionDeadline),
    config: data.config ?? null,
    firstBakedAt: nullableIsoString(data.firstBakedAt),
    lastBakedAt: nullableIsoString(data.lastBakedAt),
    expiresAt: nullableIsoString(data.expiresAt),
    isPinned: Boolean(data.isPinned),
    lastOpenedAt: nullableIsoString(data.lastOpenedAt),
    schemaVersion: Number(data.schemaVersion ?? 1),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  });
}

function inputToFirestore(input: UpdateRoomInput) {
  const data: Record<string, unknown> = { ...input };
  if (input.collectionDeadline !== undefined) {
    data.collectionDeadline = toTimestamp(input.collectionDeadline);
  }
  if (input.expiresAt !== undefined) {
    data.expiresAt = toTimestamp(input.expiresAt);
  }
  return data;
}

export class FirestoreRoomRepository implements RoomRepository {
  async listRooms(ownerUid: string): Promise<Room[]> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .where("ownerUid", "==", ownerUid)
      .get();

    return snapshot.docs
      .map((doc) => mapRoom(doc.id, doc.data()))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  async getRoom(id: string): Promise<Room | null> {
    const snapshot = await firestoreDb().collection("rooms").doc(id).get();
    if (!snapshot.exists) return null;
    return mapRoom(snapshot.id, snapshot.data()!);
  }

  async createRoom(ownerUid: string, input: CreateRoomInput): Promise<Room> {
    const id = createId("room");
    const now = new Date().toISOString();
    const room: Room = roomSchema.parse({
      ...input,
      id,
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
    });

    const { id: _id, ...roomDocument } = room;
    void _id;

    await firestoreDb()
      .collection("rooms")
      .doc(id)
      .set({
        ...roomDocument,
        collectionDeadline: toTimestamp(room.collectionDeadline),
        config: null,
        firstBakedAt: null,
        lastBakedAt: null,
        expiresAt: toTimestamp(room.expiresAt),
        lastOpenedAt: null,
        createdAt: toTimestamp(room.createdAt),
        updatedAt: toTimestamp(room.updatedAt),
      });

    return room;
  }

  async updateRoom(id: string, patch: UpdateRoomInput): Promise<Room> {
    const ref = firestoreDb().collection("rooms").doc(id);
    const current = await ref.get();
    if (!current.exists) throw new Error(`Room not found: ${id}`);

    await ref.update({
      ...inputToFirestore(patch),
      updatedAt: toTimestamp(new Date().toISOString()),
    });

    const updated = await ref.get();
    return mapRoom(updated.id, updated.data()!);
  }

  async deleteRoom(id: string): Promise<void> {
    const ref = firestoreDb().collection("rooms").doc(id);
    const current = await ref.get();
    if (!current.exists) throw new Error(`Room not found: ${id}`);
    await ref.delete();
  }

  async setPinned(id: string, pinned: boolean): Promise<Room> {
    const ref = firestoreDb().collection("rooms").doc(id);
    const current = await ref.get();
    if (!current.exists) throw new Error(`Room not found: ${id}`);

    await ref.update({
      isPinned: pinned,
      updatedAt: toTimestamp(new Date().toISOString()),
    });

    const updated = await ref.get();
    return mapRoom(updated.id, updated.data()!);
  }

  async touchLastOpened(
    id: string,
    openedAt = new Date().toISOString(),
  ): Promise<Room> {
    const ref = firestoreDb().collection("rooms").doc(id);
    const current = await ref.get();
    if (!current.exists) throw new Error(`Room not found: ${id}`);

    await ref.update({
      lastOpenedAt: toTimestamp(openedAt),
    });

    const updated = await ref.get();
    return mapRoom(updated.id, updated.data()!);
  }
}
