import { ApiError } from "@/lib/http";
import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import {
  submissionSchema,
  type Media,
  type Submission,
  type SubmissionModeration,
} from "@/lib/data/contracts";
import type {
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
    moderation: data.moderation ?? null,
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
        !roomSnapshot.exists || roomData?.config?._deleting ||
        roomData?.status !== "collecting" ||
        !Number.isFinite(deadlineMs) ||
        deadlineMs <= Date.now()
      ) {
        return "closed" as const;
      }

      let previousCount = roomData?.contributionCount;
      let previousBytes = roomData?.contributionBytes;
      // Older production Rooms predate counters. Seed them transactionally once
      // instead of granting existing Rooms another full allowance after rollout.
      if (previousCount === undefined || previousBytes === undefined) {
        const [submissions, media] = await Promise.all([
          transaction.get(roomRef.collection("submissions")),
          transaction.get(roomRef.collection("media")),
        ]);
        const sizes = new Map<string, number>();
        submissions.docs.forEach(doc => (doc.data().stagedMedia ?? []).forEach((item: { id: string; sizeBytes: number }) => sizes.set(item.id, item.sizeBytes)));
        media.docs.forEach(doc => sizes.set(doc.id, Number(doc.data().sizeBytes ?? 0)));
        previousCount ??= submissions.size;
        previousBytes ??= [...sizes.values()].reduce((sum, size) => sum + size, 0);
      }
      const count = Number(previousCount);
      const bytes = Number(previousBytes) + submission.stagedMedia.reduce((sum, media) => sum + media.sizeBytes, 0);
      if (count >= 100 || bytes > 2 * 1024 ** 3) throw new ApiError("ROOM_CAPACITY", "Room sudah mencapai batas 100 kiriman atau 2 GB media. Hubungi pembuat Room.", 409);
      transaction.update(roomRef, { contributionCount: count + 1, contributionBytes: bytes });
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

  async claimModeration(
    roomId: string,
    submissionId: string,
    decision: SubmissionModeration,
  ): Promise<Submission | null> {
    const db = firestoreDb();
    const roomRef = db.collection("rooms").doc(roomId);
    const submissionRef = roomRef.collection("submissions").doc(submissionId);

    return db.runTransaction(async (transaction) => {
      const parent = await transaction.get(roomRef);
      if (!parent.exists || parent.data()?.config?._deleting) throw new ApiError("ROOM_DELETING", "Room sudah tidak tersedia.", 409);
      const snapshot = await transaction.get(submissionRef);
      if (!snapshot.exists) {
        if (decision.action === "delete") return null;
        throw new ApiError("SUBMISSION_NOT_FOUND", "Kiriman tidak ditemukan. Muat ulang Room.", 404);
      }

      const current = mapSubmission(snapshot.id, snapshot.data()!);
      if (current.source === "owner") throw new ApiError("OWNER_MEDIA_NOT_MODERATABLE", "Media pemilik tidak masuk antrean kiriman.", 409);
      const ids = new Set([...current.mediaIds, ...current.stagedMedia.map(item => item.id)]);
      if (decision.acceptedMediaIds.some(id => !ids.has(id))) throw new ApiError("INVALID_MEDIA_SELECTION", "Ada media yang tidak berasal dari kiriman ini. Muat ulang Room.", 400);
      if (current.moderation) {
        if (JSON.stringify(current.moderation) !== JSON.stringify(decision)) {
          throw new ApiError("MODERATION_IN_PROGRESS", "Pilihan kiriman ini sedang diselesaikan. Muat ulang lalu tekan Lanjutkan penyimpanan untuk menyelesaikan pilihan sebelumnya.", 409);
        }
        return current;
      }
      if (current.status === "approved") {
        if (decision.action === "approve" && JSON.stringify([...current.mediaIds].sort()) === JSON.stringify(decision.acceptedMediaIds)) return current;
        throw new ApiError("APPROVED_MEDIA_PROTECTED", "Kiriman yang sudah diterima tetap disimpan agar tautan terbitan tidak rusak. Atur media yang ditampilkan melalui Studio.", 409);
      }
      if (current.status === "excluded" && decision.action !== "delete") {
        if (decision.action === "exclude" || decision.acceptedMediaIds.length === 0) return current;
        throw new ApiError("MODERATION_FINISHED", "Kiriman ini sudah diperiksa. Muat ulang Room.", 409);
      }
      transaction.update(submissionRef, { moderation: decision });
      return { ...current, moderation: decision };
    });
  }

  async finishModeration(roomId: string, submissionId: string, decision: SubmissionModeration, media: Media[], reviewedAt: string): Promise<Submission | null> {
    const db = firestoreDb();
    const roomRef = db.collection("rooms").doc(roomId);
    const submissionRef = roomRef.collection("submissions").doc(submissionId);
    return db.runTransaction(async transaction => {
      const parent = await transaction.get(roomRef);
      if (!parent.exists || parent.data()?.config?._deleting) throw new ApiError("ROOM_DELETING", "Room sudah tidak tersedia.", 409);
      const snapshot = await transaction.get(submissionRef);
      if (!snapshot.exists) return null;
      const current = mapSubmission(snapshot.id, snapshot.data()!);
      if (!current.moderation && current.status !== "new") return current;
      if (JSON.stringify(current.moderation) !== JSON.stringify(decision)) throw new ApiError("MODERATION_CHANGED", "Pilihan kiriman berubah. Muat ulang Room.", 409);
      const acceptedIds = new Set(decision.acceptedMediaIds);
      if (JSON.stringify(media.map(item => item.id).sort()) !== JSON.stringify(decision.acceptedMediaIds)) throw new Error("Moderation media does not match the reserved selection.");
      const allIds = new Set([...current.mediaIds, ...current.stagedMedia.map(item => item.id)]);
      for (const id of allIds) {
        if (!acceptedIds.has(id)) transaction.delete(roomRef.collection("media").doc(id));
      }
      if (decision.action === "delete") {
        transaction.delete(submissionRef);
        return null;
      }
      const status = decision.action === "approve" && (media.length > 0 || Boolean(current.message?.trim())) ? "approved" : "excluded";

      transaction.update(submissionRef, {
        status,
        reviewedAt: toTimestamp(reviewedAt),
        mediaIds: media.map((item) => item.id),
        stagedMedia: [],
        moderation: null,
      });

      for (const item of media) {
        // set() intentionally supports migration from the previous Patch 4 model where
        // pending media documents were already created before moderation.
        transaction.set(roomRef.collection("media").doc(item.id), mediaDocument(item));
      }

      return { ...current, status, reviewedAt, mediaIds: media.map(item => item.id), stagedMedia: [], moderation: null };
    });
  }
}
