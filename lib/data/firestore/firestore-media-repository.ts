import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import { mediaSchema, type Media } from "@/lib/data/contracts";
import type { MediaCreateManyResult, MediaRepository } from "@/lib/data/repositories";
import { firestoreDb, toIsoString, toTimestamp } from "./shared";

function mapMedia(id: string, data: DocumentData): Media {
  return mediaSchema.parse({
    id,
    roomId: data.roomId,
    submissionId: data.submissionId ?? null,
    type: data.type,
    storageObjectKey: data.storageObjectKey,
    originalFileName: data.originalFileName,
    contentType: data.contentType,
    sizeBytes: Number(data.sizeBytes ?? 0),
    message: data.message ?? null,
    contributorName: data.contributorName ?? null,
    source: data.source ?? "contributor",
    uploaderUid: data.uploaderUid ?? null,
    submittedAt: toIsoString(data.submittedAt),
    durationSec: data.durationSec,
    width: data.width,
    height: data.height,
    analysisStatus: data.analysisStatus ?? "not_started",
    analysisVersion: data.analysisVersion ?? null,
    analysisMode: data.analysisMode ?? null,
    analysisUpdatedAt: data.analysisUpdatedAt ? toIsoString(data.analysisUpdatedAt) : null,
    needsDeepAnalysis: Boolean(data.needsDeepAnalysis ?? false),
    analysisFailureCode: data.analysisFailureCode ?? null,
    technicalSignals: data.technicalSignals ?? null,
    mediaIntelligence: data.mediaIntelligence ?? null,
  });
}

function mediaDocument(item: Media) {
  return {
    id: item.id,
    roomId: item.roomId,
    submissionId: item.submissionId,
    type: item.type,
    storageObjectKey: item.storageObjectKey,
    originalFileName: item.originalFileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    message: item.message,
    contributorName: item.contributorName,
    source: item.source,
    uploaderUid: item.uploaderUid,
    submittedAt: toTimestamp(item.submittedAt),
    ...(item.durationSec !== undefined ? { durationSec: item.durationSec } : {}),
    ...(item.width !== undefined ? { width: item.width } : {}),
    ...(item.height !== undefined ? { height: item.height } : {}),
    analysisStatus: item.analysisStatus,
    analysisVersion: item.analysisVersion,
    analysisMode: item.analysisMode,
    analysisUpdatedAt: item.analysisUpdatedAt ? toTimestamp(item.analysisUpdatedAt) : null,
    needsDeepAnalysis: item.needsDeepAnalysis,
    analysisFailureCode: item.analysisFailureCode,
    technicalSignals: item.technicalSignals,
    mediaIntelligence: item.mediaIntelligence,
  };
}

export class FirestoreMediaRepository implements MediaRepository {
  async listByRoom(roomId: string): Promise<Media[]> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("media")
      .get();

    return snapshot.docs
      .map((doc) => mapMedia(doc.id, doc.data()))
      .sort(
        (a, b) =>
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      );
  }

  async getById(roomId: string, id: string): Promise<Media | null> {
    const doc = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("media")
      .doc(id)
      .get();
    return doc.exists ? mapMedia(doc.id, doc.data()!) : null;
  }

  async createMany(media: Media[]): Promise<MediaCreateManyResult> {
    if (media.length === 0) return "exists";
    const db = firestoreDb();

    return db.runTransaction(async (transaction) => {
      const refs = media.map((item) =>
        db.collection("rooms").doc(item.roomId).collection("media").doc(item.id),
      );
      const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
      if (snapshots.every((snapshot) => snapshot.exists)) return "exists" as const;

      for (let index = 0; index < media.length; index += 1) {
        if (!snapshots[index].exists) {
          transaction.create(refs[index], mediaDocument(media[index]));
        }
      }
      return "created" as const;
    });
  }

  async updateStorageObjectKeys(
    updates: Array<{ roomId: string; mediaId: string; storageObjectKey: string }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    const db = firestoreDb();
    const batch = db.batch();
    for (const update of updates) {
      batch.update(
        db.collection("rooms").doc(update.roomId).collection("media").doc(update.mediaId),
        { storageObjectKey: update.storageObjectKey },
      );
    }
    await batch.commit();
  }

  async updateAnalysis(roomId: string, mediaId: string, media: Media): Promise<void> {
    await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("media")
      .doc(mediaId)
      .update({
        ...(media.durationSec !== undefined ? { durationSec: media.durationSec } : {}),
        ...(media.width !== undefined ? { width: media.width } : {}),
        ...(media.height !== undefined ? { height: media.height } : {}),
        analysisStatus: media.analysisStatus,
        analysisVersion: media.analysisVersion,
        analysisMode: media.analysisMode,
        analysisUpdatedAt: media.analysisUpdatedAt ? toTimestamp(media.analysisUpdatedAt) : null,
        needsDeepAnalysis: media.needsDeepAnalysis,
        analysisFailureCode: media.analysisFailureCode,
        technicalSignals: media.technicalSignals,
        mediaIntelligence: media.mediaIntelligence,
      });
  }

  async deleteMany(roomId: string, mediaIds: string[]): Promise<void> {
    if (mediaIds.length === 0) return;
    const db = firestoreDb();
    const batch = db.batch();
    const media = db.collection("rooms").doc(roomId).collection("media");
    for (const id of mediaIds) batch.delete(media.doc(id));
    await batch.commit();
  }
}
