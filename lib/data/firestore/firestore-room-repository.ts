import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import {
  roomSchema,
  type CreateRoomInput,
  type Room,
  type RoomStatus,
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

  async getRoomByCollectorId(collectorId: string): Promise<Room | null> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .where("collectorId", "==", collectorId)
      .limit(1)
      .get();
    const doc = snapshot.docs[0];
    return doc ? mapRoom(doc.id, doc.data()) : null;
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

  async updateRoom(
    id: string,
    patch: UpdateRoomInput,
    updatedAt: string,
  ): Promise<void> {
    await firestoreDb().collection("rooms").doc(id).update({
      ...inputToFirestore(patch),
      updatedAt: toTimestamp(updatedAt),
    });
  }

  async deleteRoom(id: string): Promise<void> {
    await firestoreDb().collection("rooms").doc(id).delete();
  }

  async setPinned(
    id: string,
    pinned: boolean,
    updatedAt: string,
  ): Promise<void> {
    await firestoreDb().collection("rooms").doc(id).update({
      isPinned: pinned,
      updatedAt: toTimestamp(updatedAt),
    });
  }

  async setStatus(
    id: string,
    status: RoomStatus,
    updatedAt: string,
  ): Promise<void> {
    await firestoreDb().collection("rooms").doc(id).update({
      status,
      updatedAt: toTimestamp(updatedAt),
    });
  }

  async setConfig(
    id: string,
    config: Room["config"],
    updatedAt: string,
  ): Promise<void> {
    await firestoreDb().collection("rooms").doc(id).update({
      config,
      updatedAt: toTimestamp(updatedAt),
    });
  }

  async touchLastOpened(id: string, openedAt: string): Promise<void> {
    await firestoreDb().collection("rooms").doc(id).update({
      lastOpenedAt: toTimestamp(openedAt),
    });
  }
}
