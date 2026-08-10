import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import {
  submissionSchema,
  type Media,
  type Submission,
  type SubmissionStatus,
} from "@/lib/data/contracts";
import type {
  SubmissionApprovalResult,
  SubmissionCreateResult,
  SubmissionRepository,
} from "@/lib/data/repositories";
import { firestoreDb, nullableIsoString, toIsoString, toTimestamp } from "./shared";

function mapSubmission(id: string, data: DocumentData): Submission {
  return submissionSchema.parse({
    id,
    roomId: data.roomId,
    mediaIds: data.mediaIds ?? [],
    stagedMedia: data.stagedMedia ?? [],
    message: data.message ?? null,
    contributorName: data.contributorName ?? null,
    source: data.source ?? "contributor",
    status: data.status,
    submittedAt: toIsoString(data.submittedAt),
    reviewedAt: nullableIsoString(data.reviewedAt),
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

export class FirestoreSubmissionRepository implements SubmissionRepository {
  async listByRoom(roomId: string): Promise<Submission[]> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("submissions")
      .get();

    return snapshot.docs
      .map((doc) => mapSubmission(doc.id, doc.data()))
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      );
  }

  async getById(roomId: string, id: string): Promise<Submission | null> {
    const doc = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("submissions")
      .doc(id)
      .get();
    return doc.exists ? mapSubmission(doc.id, doc.data()!) : null;
  }

  async createPending(submission: Submission): Promise<SubmissionCreateResult> {
    const db = firestoreDb();
    const roomRef = db.collection("rooms").doc(submission.roomId);

    return db.runTransaction(async (transaction) => {
      const submissionRef = roomRef.collection("submissions").doc(submission.id);
      const [roomSnapshot, existingSubmission] = await Promise.all([
        transaction.get(roomRef),
        transaction.get(submissionRef),
      ]);
      if (existingSubmission.exists) return "exists" as const;

      const roomData = roomSnapshot.data();
      const deadline = roomData?.collectionDeadline;
      const deadlineMs = deadline?.toMillis?.() ?? Date.parse(String(deadline ?? ""));
      if (
        !roomSnapshot.exists ||
        roomData?.status !== "collecting" ||
        !Number.isFinite(deadlineMs) ||
        deadlineMs <= Date.now()
      ) {
        return "closed" as const;
      }

      transaction.create(submissionRef, {
        id: submission.id,
        roomId: submission.roomId,
        mediaIds: [],
        stagedMedia: submission.stagedMedia,
        message: submission.message,
        contributorName: submission.contributorName,
        source: submission.source,
        status: submission.status,
        submittedAt: toTimestamp(submission.submittedAt),
        reviewedAt: null,
      });

      return "created" as const;
    });
  }

  async approveWithMedia(
    roomId: string,
    submissionId: string,
    media: Media[],
    reviewedAt: string,
  ): Promise<SubmissionApprovalResult> {
    const db = firestoreDb();
    const roomRef = db.collection("rooms").doc(roomId);
    const submissionRef = roomRef.collection("submissions").doc(submissionId);

    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(submissionRef);
      if (!snapshot.exists) return "not_found" as const;

      const current = mapSubmission(snapshot.id, snapshot.data()!);
      if (current.status === "approved") return "exists" as const;
      if (current.status !== "new") return "exists" as const;

      transaction.update(submissionRef, {
        status: "approved",
        reviewedAt: toTimestamp(reviewedAt),
        mediaIds: media.map((item) => item.id),
        stagedMedia: [],
      });

      for (const item of media) {
        // set() intentionally supports migration from the previous Patch 4 model where
        // pending media documents were already created before moderation.
        transaction.set(roomRef.collection("media").doc(item.id), mediaDocument(item));
      }

      return "updated" as const;
    });
  }

  async updateStatuses(
    roomId: string,
    submissionIds: string[],
    status: SubmissionStatus,
    reviewedAt: string,
    options?: { clearStagedMedia?: boolean; clearMediaIds?: boolean },
  ): Promise<void> {
    if (submissionIds.length === 0) return;
    const db = firestoreDb();
    const batch = db.batch();
    const submissions = db.collection("rooms").doc(roomId).collection("submissions");

    for (const id of submissionIds) {
      batch.update(submissions.doc(id), {
        status,
        reviewedAt: toTimestamp(reviewedAt),
        ...(options?.clearStagedMedia ? { stagedMedia: [] } : {}),
        ...(options?.clearMediaIds ? { mediaIds: [] } : {}),
      });
    }

    await batch.commit();
  }

  async deleteSubmission(roomId: string, submissionId: string): Promise<void> {
    await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("submissions")
      .doc(submissionId)
      .delete();
  }
}
