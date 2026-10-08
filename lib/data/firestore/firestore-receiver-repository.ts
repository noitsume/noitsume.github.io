import "server-only";
import { ApiError } from "@/lib/http";

import type { DocumentData } from "firebase-admin/firestore";
import {
  receiverAssetRecordSchema,
  receiverManifestSchema,
  type ReceiverAssetRecord,
  type ReceiverManifest,
} from "@/lib/data/contracts";
import type {
  PublishReceiverSnapshotInput,
  ReceiverRepository,
} from "@/lib/data/repositories";
import { firestoreDb, toIsoString, toTimestamp } from "./shared";

function mapManifest(id: string, data: DocumentData): ReceiverManifest {
  return receiverManifestSchema.parse({
    ...data,
    receiverId: id,
    bakedAt: toIsoString(data.bakedAt),
  });
}

export class FirestoreReceiverRepository implements ReceiverRepository {
  async getManifest(receiverId: string): Promise<ReceiverManifest | null> {
    const snapshot = await firestoreDb().collection("receivers").doc(receiverId).get();
    if (!snapshot.exists) return null;
    return mapManifest(snapshot.id, snapshot.data()!);
  }

  async getAsset(receiverId: string, assetId: string): Promise<ReceiverAssetRecord | null> {
    const snapshot = await firestoreDb()
      .collection("receivers")
      .doc(receiverId)
      .collection("assets")
      .doc(assetId)
      .get();
    if (!snapshot.exists) return null;
    return receiverAssetRecordSchema.parse({
      ...snapshot.data(),
      id: snapshot.id,
      receiverId,
    });
  }

  async publishSnapshot(input: PublishReceiverSnapshotInput): Promise<ReceiverManifest> {
    const db = firestoreDb();
    const roomRef = db.collection("rooms").doc(input.roomId);
    return db.runTransaction(async (transaction) => {
      const roomSnapshot = await transaction.get(roomRef);
      const room = roomSnapshot.data();
      if (!room || room.config?._deleting) throw new ApiError("ROOM_NOT_FOUND", "Room tidak ditemukan saat penerbitan.", 404);
      if (room.config?.studio?.updatedAt !== input.expectedStudioUpdatedAt || room.themeId !== input.manifest.theme.id || room.title !== input.manifest.room.title || room.recipientName !== input.manifest.room.recipientName) {
        throw new ApiError("STUDIO_CHANGED", "Isi Room berubah saat disiapkan. Periksa Studio lalu terbitkan kembali.", 409);
      }
      const receiverId = room.receiverId ?? input.receiverId;
      const receiverRef = db.collection("receivers").doc(receiverId);
      const receiverSnapshot = await transaction.get(receiverRef);
      // A retried or simultaneous request reuses the successful publication.
      if (room.status === "ready" && receiverSnapshot.exists) return mapManifest(receiverId, receiverSnapshot.data()!);
      if (room.status !== "configuring" && room.status !== "baking") throw new ApiError("ROOM_CHANGED", "Room belum siap diterbitkan.", 409);

      const revision = Number(receiverSnapshot.data()?.revision ?? 0) + 1;
      const manifest = receiverManifestSchema.parse({
        ...input.manifest,
        receiverId,
        revision,
        bakedAt: input.bakedAt,
      });

      const { receiverId: _receiverId, bakedAt: _bakedAt, ...document } = manifest;
      void _receiverId;
      void _bakedAt;
      transaction.set(receiverRef, {
        ...document,
        bakedAt: toTimestamp(input.bakedAt),
      });

      for (const asset of input.assets) {
        const parsed = receiverAssetRecordSchema.parse(asset);
        const { id: _id, receiverId: _assetReceiverId, ...assetDocument } = parsed;
        void _id;
        void _assetReceiverId;
        transaction.set(receiverRef.collection("assets").doc(parsed.id), assetDocument);
      }

      const firstBakedAt = roomSnapshot.data()?.firstBakedAt ?? toTimestamp(input.bakedAt);
      transaction.update(roomRef, {
        receiverId,
        status: "ready",
        firstBakedAt,
        lastBakedAt: toTimestamp(input.bakedAt),
        updatedAt: toTimestamp(input.bakedAt),
      });

      return manifest;
    });
  }
}
