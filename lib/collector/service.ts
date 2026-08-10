import "server-only";

import { extname } from "node:path";
import {
  mediaSchema,
  roomSchema,
  stagedSubmissionMediaSchema,
  submissionSchema,
  type Media,
  type Room,
  type StagedSubmissionMedia,
  type Submission,
} from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError } from "@/lib/http";
import { analyzeMediaProxy } from "@/lib/media-intelligence/server";
import {
  createIngestUploadUrl,
  createPrivateDownloadUrl,
  deletePrivateChildPrefixesCompletely,
  deletePrivateObjects,
  deletePrivatePrefixCompletely,
  headPrivateObject,
  promotePrivateObject,
} from "@/lib/storage/b2";
import { createId } from "@/lib/utils/id";
import {
  COLLECTOR_MAX_IMAGE_BYTES,
  COLLECTOR_MAX_VIDEO_BYTES,
  collectorMediaRules,
  type CollectorContentType,
} from "./constants";
import type {
  CollectorSubmitRequest,
  CollectorUploadUrlsRequest,
  OwnerMediaAnalysisRequest,
  OwnerMediaCommitRequest,
  OwnerPreviewUrlsRequest,
} from "./schemas";

type UploadRequest = CollectorUploadUrlsRequest;
type SubmitRequest = CollectorSubmitRequest;

type PreparedUpload = {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
  contentType: string;
  sizeBytes: number;
  originalFileName: string;
  type: "photo" | "video";
};

// Compatibility-only cleanup: Patch 4.2 used name-only deletes on a versioned
// B2 bucket, which can leave hidden staging versions. Run at most once per warm
// server instance/Room; normal Patch 5.1 moderation purges staging immediately.
const stagingCompatibilityCleanupRooms = new Set<string>();

function isDeadlinePassed(room: Room) {
  return Date.parse(room.collectionDeadline) <= Date.now();
}

async function normalizeCollectorRoom(room: Room) {
  if (room.status === "collecting" && isDeadlinePassed(room)) {
    const updatedAt = new Date().toISOString();
    await backendRepositories.rooms.setStatus(room.id, "closed", updatedAt);
    return roomSchema.parse({ ...room, status: "closed", updatedAt });
  }
  return room;
}

export async function getCollectorRoom(collectorId: string) {
  const found = await backendRepositories.rooms.getRoomByCollectorId(collectorId);
  if (!found) {
    throw new ApiError("COLLECTOR_NOT_FOUND", "Collector tidak ditemukan.", 404);
  }
  return normalizeCollectorRoom(found);
}

export async function requireOpenCollectorRoom(collectorId: string) {
  const room = await getCollectorRoom(collectorId);
  if (room.status !== "collecting") {
    throw new ApiError("COLLECTION_CLOSED", "Pengumpulan untuk Room ini sudah ditutup.", 409);
  }
  return room;
}

async function requireOwnedRoom(ownerUid: string, roomId: string) {
  const room = await backendRepositories.rooms.getRoom(roomId);
  if (!room) throw new ApiError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
  if (room.ownerUid !== ownerUid) {
    throw new ApiError("ROOM_FORBIDDEN", "Kamu tidak memiliki akses ke Room ini.", 403);
  }
  return room;
}

function ruleFor(contentType: string) {
  const rule = collectorMediaRules[contentType as CollectorContentType];
  if (!rule) {
    throw new ApiError("UNSUPPORTED_MEDIA", "Format media belum didukung.", 400);
  }
  return rule;
}

function validateFile(name: string, contentType: string, sizeBytes: number) {
  const rule = ruleFor(contentType);
  const extension = extname(name).toLowerCase();
  if (!(rule.extensions as readonly string[]).includes(extension)) {
    throw new ApiError(
      "INVALID_EXTENSION",
      `Ekstensi ${extension || "file"} tidak cocok dengan tipe media.`,
      400,
    );
  }

  const maxBytes = rule.type === "photo" ? COLLECTOR_MAX_IMAGE_BYTES : COLLECTOR_MAX_VIDEO_BYTES;
  if (sizeBytes > maxBytes) {
    throw new ApiError(
      "FILE_TOO_LARGE",
      rule.type === "photo" ? "Foto maksimal 20 MB." : "Video maksimal 200 MB.",
      413,
    );
  }

  return { rule, extension };
}

async function prepareUploads(
  room: Room,
  input: UploadRequest,
  objectKeyFor: (mediaId: string, extension: string) => string,
) {
  return Promise.all(
    input.files.map(async (file): Promise<PreparedUpload> => {
      const { rule, extension } = validateFile(file.name, file.contentType, file.sizeBytes);
      const mediaId = createId("media");
      const objectKey = objectKeyFor(mediaId, extension);
      const uploadUrl = await createIngestUploadUrl({
        objectKey,
        contentType: file.contentType,
        expiresInSeconds: 900,
      });

      return {
        mediaId,
        objectKey,
        uploadUrl,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        originalFileName: file.name,
        type: rule.type,
      };
    }),
  );
}

export async function prepareCollectorUploads(collectorId: string, input: UploadRequest) {
  const room = await requireOpenCollectorRoom(collectorId);
  const submissionId = createId("submission");
  const uploads = await prepareUploads(
    room,
    input,
    (mediaId, extension) => `rooms/${room.id}/submissions/${submissionId}/${mediaId}${extension}`,
  );
  return { submissionId, uploads };
}

export async function prepareOwnerUploads(ownerUid: string, roomId: string, input: UploadRequest) {
  const room = await requireOwnedRoom(ownerUid, roomId);
  const uploads = await prepareUploads(
    room,
    input,
    (mediaId, extension) => `rooms/${room.id}/media/${mediaId}${extension}`,
  );
  return { uploads };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function attachQuickLookAnalysis(
  verified: StagedSubmissionMedia[],
  candidates: OwnerMediaCommitRequest["media"],
) {
  const candidateById = new Map(candidates.map((item) => [item.id, item]));
  return mapWithConcurrency(verified, 3, async (item) => {
    const candidate = candidateById.get(item.id);
    if (!candidate?.analysis) {
      return {
        ...item,
        analysisStatus: "not_started" as const,
        analysisVersion: null,
        analysisMode: null,
        analysisUpdatedAt: null,
        needsDeepAnalysis: true,
        analysisFailureCode: "preprocess_failed",
        technicalSignals: null,
        mediaIntelligence: null,
      };
    }

    const result = await analyzeMediaProxy({
      ...candidate.analysis,
      mode: "quick_look",
      technicalSignals: {
        ...candidate.analysis.technicalSignals,
        fileSizeBytes: item.sizeBytes,
      },
    });
    return {
      ...item,
      analysisStatus: result.analysis.status,
      analysisVersion: result.analysis.version,
      analysisMode: result.analysis.mode,
      analysisUpdatedAt: result.analysis.updatedAt,
      needsDeepAnalysis: result.analysis.needsDeepAnalysis,
      analysisFailureCode: result.analysis.failureCode,
      technicalSignals: result.technicalSignals,
      mediaIntelligence: result.mediaIntelligence,
    };
  });
}

async function verifyUploadedCandidates(input: {
  room: Room;
  candidates: OwnerMediaCommitRequest["media"];
  expectedObjectKey: (candidate: OwnerMediaCommitRequest["media"][number], extension: string) => string;
}) {
  const verified: StagedSubmissionMedia[] = [];

  for (const candidate of input.candidates) {
    const { rule, extension } = validateFile(
      candidate.originalFileName,
      candidate.contentType,
      candidate.sizeBytes,
    );

    if (candidate.type !== rule.type) {
      throw new ApiError("INVALID_MEDIA_TYPE", "Tipe media tidak sesuai dengan MIME file.", 400);
    }

    const expectedKey = input.expectedObjectKey(candidate, extension);
    if (candidate.objectKey !== expectedKey) {
      throw new ApiError("INVALID_OBJECT_KEY", "Object media tidak dimiliki upload ini.", 400);
    }

    let head;
    try {
      head = await headPrivateObject(candidate.objectKey);
    } catch {
      throw new ApiError("UPLOAD_INCOMPLETE", `Upload ${candidate.originalFileName} belum selesai.`, 409);
    }

    const storedSize = Number(head.ContentLength ?? -1);
    if (storedSize !== candidate.sizeBytes) {
      throw new ApiError("UPLOAD_SIZE_MISMATCH", `Ukuran ${candidate.originalFileName} tidak sesuai.`, 409);
    }
    if (head.ContentType && head.ContentType !== candidate.contentType) {
      throw new ApiError("UPLOAD_TYPE_MISMATCH", `Tipe ${candidate.originalFileName} tidak sesuai.`, 409);
    }

    verified.push({
      id: candidate.id,
      type: candidate.type,
      storageObjectKey: candidate.objectKey,
      originalFileName: candidate.originalFileName,
      contentType: candidate.contentType,
      sizeBytes: candidate.sizeBytes,
    });
  }

  return verified;
}

export async function commitCollectorSubmission(collectorId: string, input: SubmitRequest) {
  const room = await requireOpenCollectorRoom(collectorId);
  const now = new Date().toISOString();
  const submissionId = input.media.length > 0 ? input.submissionId! : createId("submission");
  const contributorName = normalizeOptionalText(input.contributorName);
  const message = normalizeOptionalText(input.message);

  // Idempotent retry: once a submission exists, do not re-verify or rewrite it.
  if (input.media.length > 0) {
    const existing = await backendRepositories.submissions.getById(room.id, submissionId);
    if (existing) return { submission: existing };
  }

  const verifiedMedia = await verifyUploadedCandidates({
    room,
    candidates: input.media,
    expectedObjectKey: (candidate, extension) =>
      `rooms/${room.id}/submissions/${submissionId}/${candidate.id}${extension}`,
  });
  const stagedMedia = await attachQuickLookAnalysis(verifiedMedia, input.media);

  const submission = submissionSchema.parse({
    id: submissionId,
    roomId: room.id,
    mediaIds: [],
    stagedMedia,
    message,
    contributorName,
    source: "contributor",
    status: "new",
    submittedAt: now,
    reviewedAt: null,
  });

  const createResult = await backendRepositories.submissions.createPending(submission);
  if (createResult === "closed") {
    await deletePrivateObjects(stagedMedia.map((item) => item.storageObjectKey));
    throw new ApiError("COLLECTION_CLOSED", "Pengumpulan ditutup sebelum submission selesai disimpan.", 409);
  }
  if (createResult === "exists") {
    return {
      submission: (await backendRepositories.submissions.getById(room.id, submissionId)) ?? submission,
    };
  }
  return { submission };
}

export async function commitOwnerMedia(
  ownerUid: string,
  roomId: string,
  ownerName: string,
  input: OwnerMediaCommitRequest,
) {
  const room = await requireOwnedRoom(ownerUid, roomId);
  const now = new Date().toISOString();
  const existingMedia = await backendRepositories.media.listByRoom(room.id);
  const existingById = new Map(existingMedia.map((item) => [item.id, item]));
  const missingCandidates = input.media.filter((item) => !existingById.has(item.id));

  // Retry-safe: existing IDs are returned as-is and never re-run Gemini or create a second Firestore write.
  const verified = await verifyUploadedCandidates({
    room,
    candidates: missingCandidates,
    expectedObjectKey: (candidate, extension) => `rooms/${room.id}/media/${candidate.id}${extension}`,
  });
  const analyzed = await attachQuickLookAnalysis(verified, missingCandidates);

  const createdMedia = analyzed.map((item) => mediaSchema.parse({
    id: item.id,
    roomId: room.id,
    submissionId: null,
    type: item.type,
    storageObjectKey: item.storageObjectKey,
    originalFileName: item.originalFileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    message: null,
    contributorName: ownerName,
    source: "owner",
    uploaderUid: ownerUid,
    submittedAt: now,
    ...(item.technicalSignals?.durationSec !== null && item.technicalSignals?.durationSec !== undefined ? { durationSec: item.technicalSignals.durationSec } : {}),
    ...(item.technicalSignals?.width ? { width: item.technicalSignals.width } : {}),
    ...(item.technicalSignals?.height ? { height: item.technicalSignals.height } : {}),
    analysisStatus: item.analysisStatus,
    analysisVersion: item.analysisVersion,
    analysisMode: item.analysisMode,
    analysisUpdatedAt: item.analysisUpdatedAt,
    needsDeepAnalysis: item.needsDeepAnalysis,
    analysisFailureCode: item.analysisFailureCode,
    technicalSignals: item.technicalSignals,
    mediaIntelligence: item.mediaIntelligence,
  }));

  if (createdMedia.length > 0) await backendRepositories.media.createMany(createdMedia);
  const createdById = new Map(createdMedia.map((item) => [item.id, item]));
  const media = input.media
    .map((item) => existingById.get(item.id) ?? createdById.get(item.id))
    .filter((item): item is Media => Boolean(item));

  const previewEntries = await Promise.all(
    media.map(async (item) => [
      item.id,
      await createPrivateDownloadUrl({ objectKey: item.storageObjectKey, expiresInSeconds: 900 }),
    ] as const),
  );

  return {
    media,
    previewUrlByMediaId: Object.fromEntries(previewEntries),
  };
}

export async function analyzeOwnedMedia(
  ownerUid: string,
  roomId: string,
  input: OwnerMediaAnalysisRequest,
) {
  await requireOwnedRoom(ownerUid, roomId);
  const current = await backendRepositories.media.getById(roomId, input.mediaId);
  if (!current) throw new ApiError("MEDIA_NOT_FOUND", "Media tidak ditemukan.", 404);

  const result = await analyzeMediaProxy({
    ...input.analysis,
    technicalSignals: {
      ...input.analysis.technicalSignals,
      fileSizeBytes: current.sizeBytes,
    },
  });
  const updated = mediaSchema.parse({
    ...current,
    ...(result.technicalSignals.durationSec !== null ? { durationSec: result.technicalSignals.durationSec } : {}),
    ...(result.technicalSignals.width ? { width: result.technicalSignals.width } : {}),
    ...(result.technicalSignals.height ? { height: result.technicalSignals.height } : {}),
    analysisStatus: result.analysis.status,
    analysisVersion: result.analysis.version,
    analysisMode: result.analysis.mode,
    analysisUpdatedAt: result.analysis.updatedAt,
    needsDeepAnalysis: result.analysis.needsDeepAnalysis,
    analysisFailureCode: result.analysis.failureCode,
    technicalSignals: result.technicalSignals,
    mediaIntelligence: result.mediaIntelligence,
  });
  await backendRepositories.media.updateAnalysis(roomId, current.id, updated);
  return { media: updated };
}

function legacyStagedMediaForSubmission(submission: Submission, allMedia: Media[]) {
  if (submission.stagedMedia.length > 0) return submission.stagedMedia;
  const ids = new Set(submission.mediaIds);
  return allMedia
    .filter((item) => ids.has(item.id))
    .map((item) => stagedSubmissionMediaSchema.parse({
      id: item.id,
      type: item.type,
      storageObjectKey: item.storageObjectKey,
      originalFileName: item.originalFileName,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
      analysisStatus: item.analysisStatus,
      analysisVersion: item.analysisVersion,
      analysisMode: item.analysisMode,
      analysisUpdatedAt: item.analysisUpdatedAt,
      needsDeepAnalysis: item.needsDeepAnalysis,
      analysisFailureCode: item.analysisFailureCode,
      technicalSignals: item.technicalSignals,
      mediaIntelligence: item.mediaIntelligence,
    }));
}

function permanentObjectKey(roomId: string, item: StagedSubmissionMedia) {
  const { extension } = validateFile(item.originalFileName, item.contentType, item.sizeBytes);
  return `rooms/${roomId}/media/${item.id}${extension}`;
}

function mediaFromApprovedSubmission(
  roomId: string,
  submission: Submission,
  staged: StagedSubmissionMedia,
  finalObjectKey: string,
  legacy?: Media,
) {
  return mediaSchema.parse({
    id: staged.id,
    roomId,
    submissionId: submission.id,
    type: staged.type,
    storageObjectKey: finalObjectKey,
    originalFileName: staged.originalFileName,
    contentType: staged.contentType,
    sizeBytes: staged.sizeBytes,
    message: submission.message,
    contributorName: submission.contributorName,
    source: "contributor",
    uploaderUid: null,
    submittedAt: submission.submittedAt,
    durationSec: staged.technicalSignals?.durationSec ?? legacy?.durationSec,
    width: staged.technicalSignals?.width ?? legacy?.width,
    height: staged.technicalSignals?.height ?? legacy?.height,
    analysisStatus: staged.analysisStatus ?? legacy?.analysisStatus ?? "not_started",
    analysisVersion: staged.analysisVersion ?? legacy?.analysisVersion ?? null,
    analysisMode: staged.analysisMode ?? legacy?.analysisMode ?? null,
    analysisUpdatedAt: staged.analysisUpdatedAt ?? legacy?.analysisUpdatedAt ?? null,
    needsDeepAnalysis: staged.needsDeepAnalysis ?? legacy?.needsDeepAnalysis ?? false,
    analysisFailureCode: staged.analysisFailureCode ?? legacy?.analysisFailureCode ?? null,
    technicalSignals: staged.technicalSignals ?? legacy?.technicalSignals ?? null,
    mediaIntelligence: staged.mediaIntelligence ?? legacy?.mediaIntelligence ?? null,
  });
}


async function migrateLegacyPermanentMedia(
  roomId: string,
  submissions: Submission[],
  media: Media[],
) {
  const statusBySubmissionId = new Map(submissions.map((item) => [item.id, item.status]));
  const permanentPrefix = `rooms/${roomId}/media/`;
  const migrated = new Map<string, string>();

  for (const item of media) {
    const shouldBePermanent =
      item.source === "owner" ||
      !item.submissionId ||
      statusBySubmissionId.get(item.submissionId) === "approved";
    if (!shouldBePermanent || item.storageObjectKey.startsWith(permanentPrefix)) continue;

    const staged = stagedSubmissionMediaSchema.parse({
      id: item.id,
      type: item.type,
      storageObjectKey: item.storageObjectKey,
      originalFileName: item.originalFileName,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
      analysisStatus: item.analysisStatus,
      analysisVersion: item.analysisVersion,
      analysisMode: item.analysisMode,
      analysisUpdatedAt: item.analysisUpdatedAt,
      needsDeepAnalysis: item.needsDeepAnalysis,
      analysisFailureCode: item.analysisFailureCode,
      technicalSignals: item.technicalSignals,
      mediaIntelligence: item.mediaIntelligence,
    });
    const destinationKey = permanentObjectKey(roomId, staged);

    try {
      await promotePrivateObject({
        sourceKey: item.storageObjectKey,
        destinationKey,
        expectedSizeBytes: item.sizeBytes,
        expectedContentType: item.contentType,
      });
      migrated.set(item.id, destinationKey);
    } catch {
      // Compatibility migration is best-effort and retries on the next workspace load.
      // Never make the whole Room unavailable because an old object cannot be moved now.
    }
  }

  if (migrated.size === 0) return media;
  await backendRepositories.media.updateStorageObjectKeys(
    Array.from(migrated, ([mediaId, storageObjectKey]) => ({ roomId, mediaId, storageObjectKey })),
  );
  return media.map((item) => {
    const storageObjectKey = migrated.get(item.id);
    return storageObjectKey ? { ...item, storageObjectKey } : item;
  });
}

export async function moderateOwnedSubmissions(
  ownerUid: string,
  roomId: string,
  submissionIds: string[],
  action: "approve" | "exclude" | "delete",
) {
  await requireOwnedRoom(ownerUid, roomId);

  const [allSubmissions, allMedia] = await Promise.all([
    backendRepositories.submissions.listByRoom(roomId),
    backendRepositories.media.listByRoom(roomId),
  ]);
  const submissionById = new Map(allSubmissions.map((item) => [item.id, item]));
  const mediaById = new Map(allMedia.map((item) => [item.id, item]));
  const submissions = submissionIds.map((id) => submissionById.get(id));
  if (submissions.some((item) => !item)) {
    throw new ApiError("SUBMISSION_NOT_FOUND", "Ada submission yang tidak ditemukan.", 404);
  }

  const concreteSubmissions = submissions.filter((item): item is Submission => Boolean(item));
  if (concreteSubmissions.some((item) => item.source === "owner")) {
    throw new ApiError("OWNER_MEDIA_NOT_MODERATABLE", "Upload owner tidak masuk antrean moderation.", 409);
  }

  if (action === "approve") {
    const promotedMedia: Media[] = [];
    let updated = 0;

    for (const submission of concreteSubmissions) {
      if (submission.status !== "new") continue;
      const stagedMedia = legacyStagedMediaForSubmission(submission, allMedia);
      const finalMedia = await Promise.all(stagedMedia.map(async (staged) => {
        const finalObjectKey = permanentObjectKey(roomId, staged);
        try {
          await promotePrivateObject({
            sourceKey: staged.storageObjectKey,
            destinationKey: finalObjectKey,
            expectedSizeBytes: staged.sizeBytes,
            expectedContentType: staged.contentType,
            cleanupSource: false,
          });
        } catch {
          throw new ApiError(
            "MEDIA_PROMOTION_FAILED",
            `Media ${staged.originalFileName} belum berhasil dipindahkan ke inventori. Coba lagi.`,
            502,
          );
        }

        return mediaFromApprovedSubmission(
          roomId,
          submission,
          staged,
          finalObjectKey,
          mediaById.get(staged.id),
        );
      }));

      // Submission objects are staging only. Purge the whole submission prefix
      // (including old B2 versions/orphans) before Firestore marks it approved.
      // Every approved object has already been copied and verified under media/.
      await deletePrivatePrefixCompletely(
        `rooms/${roomId}/submissions/${submission.id}/`,
      );

      const result = await backendRepositories.submissions.approveWithMedia(
        roomId,
        submission.id,
        finalMedia,
        new Date().toISOString(),
      );
      if (result === "updated") {
        updated += 1;
        promotedMedia.push(...finalMedia);
      }
    }

    const previewEntries = await Promise.all(
      promotedMedia.map(async (item) => [
        item.id,
        await createPrivateDownloadUrl({ objectKey: item.storageObjectKey, expiresInSeconds: 900 }),
      ] as const),
    );

    return {
      updated,
      promotedMedia,
      previewUrlByMediaId: Object.fromEntries(previewEntries),
    };
  }

  if (action === "exclude") {
    const candidates = concreteSubmissions.filter((item) => item.status === "new");
    if (candidates.length === 0) return { updated: 0, promotedMedia: [], previewUrlByMediaId: {} };

    const legacyMediaIds = new Set<string>();
    for (const submission of candidates) {
      if (submission.stagedMedia.length === 0) {
        submission.mediaIds.forEach((id) => legacyMediaIds.add(id));
      }

      // Excluded submissions must leave no media bytes behind. Purging the
      // entire staging prefix also catches interrupted/orphan upload objects.
      await deletePrivatePrefixCompletely(
        `rooms/${roomId}/submissions/${submission.id}/`,
      );
    }

    await backendRepositories.media.deleteMany(roomId, Array.from(legacyMediaIds));
    await backendRepositories.submissions.updateStatuses(
      roomId,
      candidates.map((item) => item.id),
      "excluded",
      new Date().toISOString(),
      { clearStagedMedia: true, clearMediaIds: true },
    );

    return { updated: candidates.length, promotedMedia: [], previewUrlByMediaId: {} };
  }

  let deleted = 0;
  for (const submission of concreteSubmissions) {
    await deletePrivatePrefixCompletely(
      `rooms/${roomId}/submissions/${submission.id}/`,
    );
    const staged = legacyStagedMediaForSubmission(submission, allMedia);
    const permanent = allMedia.filter((item) => submission.mediaIds.includes(item.id));
    const keys = new Set([
      ...staged.map((item) => item.storageObjectKey),
      ...permanent.map((item) => item.storageObjectKey),
    ]);
    await deletePrivateObjects(Array.from(keys));
    await backendRepositories.media.deleteMany(
      roomId,
      Array.from(new Set([...submission.mediaIds, ...staged.map((item) => item.id)])),
    );
    await backendRepositories.submissions.deleteSubmission(roomId, submission.id);
    deleted += 1;
  }

  return { updated: deleted, promotedMedia: [], previewUrlByMediaId: {} };
}

export async function getOwnedPreviewUrls(
  ownerUid: string,
  roomId: string,
  input: OwnerPreviewUrlsRequest,
) {
  await requireOwnedRoom(ownerUid, roomId);
  const roomPrefix = `rooms/${roomId}/`;

  for (const item of input.media) {
    if (!item.objectKey.startsWith(roomPrefix) || item.objectKey.includes("..")) {
      throw new ApiError("INVALID_OBJECT_KEY", "Object media tidak berasal dari Room ini.", 400);
    }
  }

  const entries = await Promise.all(
    input.media.map(async (item) => [
      item.id,
      await createPrivateDownloadUrl({ objectKey: item.objectKey, expiresInSeconds: 900 }),
    ] as const),
  );
  return Object.fromEntries(entries);
}

export async function getOwnedWorkspaceMedia(ownerUid: string, roomId: string) {
  await requireOwnedRoom(ownerUid, roomId);

  const [submissions, fetchedMedia] = await Promise.all([
    backendRepositories.submissions.listByRoom(roomId),
    backendRepositories.media.listByRoom(roomId),
  ]);

  if (!stagingCompatibilityCleanupRooms.has(roomId)) {
    const reviewedSubmissionIds = submissions
      .filter((item) => item.status !== "new")
      .map((item) => item.id);
    if (reviewedSubmissionIds.length > 0) {
      try {
        await deletePrivateChildPrefixesCompletely(
          `rooms/${roomId}/submissions/`,
          reviewedSubmissionIds,
        );
        stagingCompatibilityCleanupRooms.add(roomId);
      } catch (error) {
        // Best-effort migration cleanup only. New moderation requests use strict
        // verified cleanup and will fail rather than leave staging bytes behind.
        console.warn("Legacy submission staging cleanup belum selesai", error);
      }
    } else {
      stagingCompatibilityCleanupRooms.add(roomId);
    }
  }

  const media = await migrateLegacyPermanentMedia(roomId, submissions, fetchedMedia);

  const mediaById = new Map(media.map((item) => [item.id, item]));
  const previewCandidates = new Map<string, string>();

  // Firestore rooms/{roomId}/media is the permanent inventory index. We do not LIST B2
  // on every workspace open; the object key stored here points to the private B2 media prefix.
  const statusBySubmissionId = new Map(submissions.map((item) => [item.id, item.status]));
  for (const item of media) {
    const status = item.submissionId ? statusBySubmissionId.get(item.submissionId) : undefined;
    if (item.source === "owner" || !item.submissionId || status === "approved") {
      previewCandidates.set(item.id, item.storageObjectKey);
    }
  }

  for (const submission of submissions) {
    if (submission.status !== "new") continue;
    const staged = submission.stagedMedia.length > 0
      ? submission.stagedMedia
      : submission.mediaIds
          .map((id) => mediaById.get(id))
          .filter((item): item is Media => Boolean(item))
          .map((item) => stagedSubmissionMediaSchema.parse({
            id: item.id,
            type: item.type,
            storageObjectKey: item.storageObjectKey,
            originalFileName: item.originalFileName,
            contentType: item.contentType,
            sizeBytes: item.sizeBytes,
            analysisStatus: item.analysisStatus,
            analysisVersion: item.analysisVersion,
            analysisMode: item.analysisMode,
            analysisUpdatedAt: item.analysisUpdatedAt,
            needsDeepAnalysis: item.needsDeepAnalysis,
            analysisFailureCode: item.analysisFailureCode,
            technicalSignals: item.technicalSignals,
            mediaIntelligence: item.mediaIntelligence,
          }));
    for (const item of staged) previewCandidates.set(item.id, item.storageObjectKey);
  }

  const previewUrls = await Promise.all(
    Array.from(previewCandidates.entries()).map(async ([id, objectKey]) => [
      id,
      await createPrivateDownloadUrl({ objectKey, expiresInSeconds: 900 }),
    ] as const),
  );

  return {
    submissions,
    media,
    previewUrlByMediaId: Object.fromEntries(previewUrls),
  };
}
