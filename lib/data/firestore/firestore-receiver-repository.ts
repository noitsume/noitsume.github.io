import "server-only";

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
    const receiverRef = db.collection("receivers").doc(input.receiverId);

    return db.runTransaction(async (transaction) => {
      const [roomSnapshot, receiverSnapshot] = await Promise.all([
        transaction.get(roomRef),
        transaction.get(receiverRef),
      ]);
      if (!roomSnapshot.exists) throw new Error("Room tidak ditemukan saat publish Receiver.");

      const currentReceiverId = roomSnapshot.data()?.receiverId ?? null;
      if (currentReceiverId && currentReceiverId !== input.receiverId) {
        throw new Error("Receiver ID Room berubah saat Bake berjalan.");
      }

      const revision = Number(receiverSnapshot.data()?.revision ?? 0) + 1;
      const manifest = receiverManifestSchema.parse({
        ...input.manifest,
        receiverId: input.receiverId,
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
        receiverId: input.receiverId,
        status: "ready",
        firstBakedAt,
        lastBakedAt: toTimestamp(input.bakedAt),
        updatedAt: toTimestamp(input.bakedAt),
      });

      return manifest;
    });
  }
}
