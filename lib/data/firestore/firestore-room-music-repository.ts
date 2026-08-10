import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import { roomMusicSchema, type RoomMusic } from "@/lib/creative";
import type { RoomMusicRepository } from "@/lib/data/repositories";
import { firestoreDb, toIsoString, toTimestamp } from "./shared";

function mapRoomMusic(id: string, data: DocumentData): RoomMusic {
  return roomMusicSchema.parse({
    id,
    schemaVersion: Number(data.schemaVersion ?? 1),
    roomId: data.roomId,
    name: data.name,
    originalFileName: data.originalFileName,
    sizeBytes: Number(data.sizeBytes ?? 0),
    track: data.track,
    beatmap: data.beatmap ?? null,
    analysis: data.analysis,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  });
}

function documentFromRoomMusic(item: RoomMusic) {
  return {
    schemaVersion: item.schemaVersion,
    roomId: item.roomId,
    name: item.name,
    originalFileName: item.originalFileName,
    sizeBytes: item.sizeBytes,
    track: item.track,
    beatmap: item.beatmap,
    analysis: item.analysis,
    createdAt: toTimestamp(item.createdAt),
    updatedAt: toTimestamp(item.updatedAt),
  };
}

export class FirestoreRoomMusicRepository implements RoomMusicRepository {
  async listByRoom(roomId: string): Promise<RoomMusic[]> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("music")
      .get();

    return snapshot.docs
      .map((doc) => mapRoomMusic(doc.id, doc.data()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getById(roomId: string, musicId: string): Promise<RoomMusic | null> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("music")
      .doc(musicId)
      .get();
    return snapshot.exists ? mapRoomMusic(snapshot.id, snapshot.data()!) : null;
  }

  async create(item: RoomMusic): Promise<"created" | "exists"> {
    const ref = firestoreDb()
      .collection("rooms")
      .doc(item.roomId)
      .collection("music")
      .doc(item.id);

    return firestoreDb().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) return "exists" as const;
      transaction.create(ref, documentFromRoomMusic(item));
      return "created" as const;
    });
  }

  async updateAnalysis(roomId: string, musicId: string, item: RoomMusic): Promise<void> {
    await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("music")
      .doc(musicId)
      .update({
        beatmap: item.beatmap,
        analysis: item.analysis,
        updatedAt: toTimestamp(item.updatedAt),
      });
  }

  async delete(roomId: string, musicId: string): Promise<void> {
    await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("music")
      .doc(musicId)
      .delete();
  }
}
