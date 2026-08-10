"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ensureFirestoreReadSession, getCsrfToken } from "@/lib/auth/client";
import { mediaSchema, submissionSchema, type Media, type RoomStatus, type Submission } from "@/lib/data/contracts";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import { Badge, CalendarIcon, InboxIcon, PhotoIcon, Surface } from "@/components/ui";
import { CollectorSharePanel } from "./collector-share-panel";
import { MediaInventoryDialog } from "./media-inventory";
import { SubmissionManager } from "./submission-manager";

const SYNC_BATCH_WINDOW_MS = 2500;

type WorkspaceData = {
  submissions: Submission[];
  media: Media[];
  previewUrlByMediaId: Record<string, string>;
};

type ModerationResult = {
  promotedMedia: Media[];
  previewUrlByMediaId: Record<string, string>;
};

function toIsoString(value: unknown) {
  if (typeof value === "string") return new Date(value).toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date(0).toISOString();
}

function mapSubmission(id: string, data: Record<string, unknown>) {
  return submissionSchema.parse({
    id,
    roomId: data.roomId,
    mediaIds: Array.isArray(data.mediaIds) ? data.mediaIds : [],
    stagedMedia: Array.isArray(data.stagedMedia) ? data.stagedMedia : [],
    message: data.message ?? null,
    contributorName: data.contributorName ?? null,
    source: data.source ?? "contributor",
    status: data.status,
    submittedAt: toIsoString(data.submittedAt),
    reviewedAt: data.reviewedAt ? toIsoString(data.reviewedAt) : null,
  });
}

function mapMedia(id: string, data: Record<string, unknown>) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function deadlineHint(value: string, isCollecting: boolean) {
  if (!isCollecting) return "Pengumpulan sudah ditutup";
  const remaining = Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (remaining <= 0) return "Berakhir hari ini";
  if (remaining === 1) return "1 hari lagi";
  return `${remaining} hari lagi`;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return Array.from(merged.values());
}

function previewObjectKeys(submissions: Submission[], media: Media[]) {
  const result = new Map<string, string>();
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const statusBySubmissionId = new Map(submissions.map((item) => [item.id, item.status]));

  for (const item of media) {
    const status = item.submissionId ? statusBySubmissionId.get(item.submissionId) : undefined;
    // Permanent inventory media is always previewable. Legacy pending documents are handled below.
    if (item.source === "owner" || !item.submissionId || status === "approved") {
      result.set(item.id, item.storageObjectKey);
    }
  }

  for (const submission of submissions) {
    if (submission.status !== "new") continue;
    if (submission.stagedMedia.length > 0) {
      for (const item of submission.stagedMedia) result.set(item.id, item.storageObjectKey);
      continue;
    }

    // Compatibility with the first Patch 4 implementation: pending media used to be
    // stored as media documents before approval.
    for (const mediaId of submission.mediaIds) {
      const legacy = mediaById.get(mediaId);
      if (legacy) result.set(legacy.id, legacy.storageObjectKey);
    }
  }

  return result;
}

export function RoomWorkspaceLive({
  roomId,
  collectorId,
  collectorUrl,
  recipientName,
  occasionName,
  themeName,
  collectionDeadline,
  initialRoomStatus,
  initialWorkspace,
}: {
  roomId: string;
  collectorId: string;
  collectorUrl: string;
  recipientName: string;
  occasionName: string;
  themeName: string;
  collectionDeadline: string;
  initialRoomStatus: RoomStatus;
  initialWorkspace: WorkspaceData;
}) {
  const router = useRouter();
  const [submissions, setSubmissions] = useState(initialWorkspace.submissions);
  const [media, setMedia] = useState(initialWorkspace.media);
  const [previewUrlByMediaId, setPreviewUrlByMediaId] = useState(initialWorkspace.previewUrlByMediaId);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>(initialRoomStatus);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncActive, setSyncActive] = useState(false);
  const stagedSubmissions = useRef(initialWorkspace.submissions);
  const stagedMedia = useRef(initialWorkspace.media);
  const previewRef = useRef(initialWorkspace.previewUrlByMediaId);
  const previewObjectKeyRef = useRef<Record<string, string>>(
    Object.fromEntries(previewObjectKeys(initialWorkspace.submissions, initialWorkspace.media)),
  );
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushVersionRef = useRef(0);
  const roomStatusRef = useRef(initialRoomStatus);

  useEffect(() => {
    previewRef.current = previewUrlByMediaId;
  }, [previewUrlByMediaId]);

  useEffect(() => {
    setRoomStatus(initialRoomStatus);
    roomStatusRef.current = initialRoomStatus;
  }, [initialRoomStatus]);

  useEffect(() => {
    let disposed = false;
    let unsubscribeSubmissions: (() => void) | null = null;
    let unsubscribeMedia: (() => void) | null = null;
    let unsubscribeRoom: (() => void) | null = null;

    function cancelTimer() {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    }

    async function flushWorkspace() {
      if (disposed) return;
      const version = ++flushVersionRef.current;
      const nextSubmissions = [...stagedSubmissions.current].sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      );
      const nextMedia = [...stagedMedia.current].sort(
        (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      );
      const nextPreviewKeys = previewObjectKeys(nextSubmissions, nextMedia);
      const missingPreview = Array.from(nextPreviewKeys.entries())
        .filter(([id, objectKey]) => !previewRef.current[id] || previewObjectKeyRef.current[id] !== objectKey)
        .map(([id, objectKey]) => ({ id, objectKey }));

      let newPreviewUrls: Record<string, string> = {};
      let previewError: string | null = null;
      if (missingPreview.length > 0) {
        try {
          const csrfToken = await getCsrfToken();
          for (let offset = 0; offset < missingPreview.length; offset += 100) {
            const chunk = missingPreview.slice(offset, offset + 100);
            const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media/preview-urls`, {
              method: "POST",
              headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
              credentials: "same-origin",
              body: JSON.stringify({ media: chunk }),
            });
            const payload = await response.json();
            if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Preview media baru belum dapat dimuat.");
            newPreviewUrls = { ...newPreviewUrls, ...(payload.data.previewUrlByMediaId ?? {}) };
          }
        } catch (error) {
          previewError = error instanceof Error ? error.message : "Preview media baru belum dapat dimuat.";
        }
      }

      if (disposed || version !== flushVersionRef.current) return;
      setSubmissions(nextSubmissions);
      setMedia(nextMedia);
      if (Object.keys(newPreviewUrls).length > 0) {
        setPreviewUrlByMediaId((current) => ({ ...current, ...newPreviewUrls }));
      }
      for (const [id, objectKey] of nextPreviewKeys) previewObjectKeyRef.current[id] = objectKey;
      setSyncError(previewError);
    }

    function scheduleFlush() {
      if (syncTimerRef.current) return;
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        void flushWorkspace();
      }, SYNC_BATCH_WINDOW_MS);
    }

    void (async () => {
      try {
        await ensureFirestoreReadSession();
        if (disposed) return;
        const db = getFirebaseClientFirestore();

        unsubscribeSubmissions = onSnapshot(
          collection(db, "rooms", roomId, "submissions"),
          (snapshot) => {
            stagedSubmissions.current = snapshot.docs.map((item) => mapSubmission(item.id, item.data()));
            scheduleFlush();
          },
          () => setSyncError("Sinkronisasi kiriman sedang tidak tersedia. Data awal tetap aman."),
        );

        unsubscribeMedia = onSnapshot(
          collection(db, "rooms", roomId, "media"),
          (snapshot) => {
            stagedMedia.current = snapshot.docs.map((item) => mapMedia(item.id, item.data()));
            scheduleFlush();
          },
          () => setSyncError("Sinkronisasi media sedang tidak tersedia. Data awal tetap aman."),
        );

        unsubscribeRoom = onSnapshot(
          doc(db, "rooms", roomId),
          (snapshot) => {
            // A successful Room deletion removes the parent document before this
            // component navigates away. Treat that as terminal instead of trying
            // to read/update workspace state from a Room that no longer exists.
            if (!snapshot.exists()) {
              setSyncActive(false);
              return;
            }
            const nextStatus = snapshot.data()?.status as RoomStatus | undefined;
            if (!nextStatus || nextStatus === roomStatusRef.current) return;
            roomStatusRef.current = nextStatus;
            setRoomStatus(nextStatus);
            router.refresh();
          },
          (error) => {
            // Firestore rules for Room subresources depend on the parent Room.
            // During intentional deletion that parent disappears, which can yield
            // permission-denied before navigation completes. Handle it explicitly
            // so Firebase does not report an uncaught snapshot-listener error.
            if (error.code === "permission-denied") {
              setSyncActive(false);
              return;
            }
            setSyncError("Sinkronisasi status Room sedang tidak tersedia.");
          },
        );

        setSyncActive(true);
      } catch (error) {
        if (!disposed) setSyncError(error instanceof Error ? error.message : "Sinkronisasi otomatis tidak dapat diaktifkan.");
      }
    })();

    return () => {
      disposed = true;
      cancelTimer();
      unsubscribeSubmissions?.();
      unsubscribeMedia?.();
      unsubscribeRoom?.();
    };
  }, [roomId, router]);

  function cancelPendingFlush() {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    flushVersionRef.current += 1;
  }

  function applyModeration(
    action: "approve" | "exclude" | "delete",
    submissionIds: string[],
    result: ModerationResult,
  ) {
    cancelPendingFlush();
    const idSet = new Set(submissionIds);
    const affected = submissions.filter((item) => idSet.has(item.id));
    const transientMediaIds = new Set(
      affected.flatMap((item) => [
        ...item.mediaIds,
        ...item.stagedMedia.map((staged) => staged.id),
      ]),
    );

    if (action === "delete") {
      setSubmissions((current) => current.filter((item) => !idSet.has(item.id)));
      setMedia((current) => current.filter((item) => !transientMediaIds.has(item.id)));
      setPreviewUrlByMediaId((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !transientMediaIds.has(id))));
      for (const id of transientMediaIds) delete previewObjectKeyRef.current[id];
      return;
    }

    const now = new Date().toISOString();
    if (action === "exclude") {
      setSubmissions((current) => current.map((item) => idSet.has(item.id)
        ? { ...item, status: "excluded", reviewedAt: now, mediaIds: [], stagedMedia: [] }
        : item));
      setMedia((current) => current.filter((item) => !transientMediaIds.has(item.id)));
      setPreviewUrlByMediaId((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !transientMediaIds.has(id))));
      for (const id of transientMediaIds) delete previewObjectKeyRef.current[id];
      return;
    }

    const promotedBySubmission = new Map<string, Media[]>();
    for (const item of result.promotedMedia) {
      if (!item.submissionId) continue;
      const list = promotedBySubmission.get(item.submissionId) ?? [];
      list.push(item);
      promotedBySubmission.set(item.submissionId, list);
      previewObjectKeyRef.current[item.id] = item.storageObjectKey;
    }

    setSubmissions((current) => current.map((item) => {
      if (!idSet.has(item.id)) return item;
      const promoted = promotedBySubmission.get(item.id) ?? [];
      return {
        ...item,
        status: "approved",
        reviewedAt: now,
        mediaIds: promoted.length > 0 ? promoted.map((mediaItem) => mediaItem.id) : item.mediaIds,
        stagedMedia: [],
      };
    }));
    setMedia((current) => mergeById(current, result.promotedMedia));
    setPreviewUrlByMediaId((current) => ({ ...current, ...result.previewUrlByMediaId }));
  }

  function applyOwnerUpload(result: { media: Media[]; previewUrlByMediaId: Record<string, string> }) {
    cancelPendingFlush();
    setMedia((current) => mergeById(current, result.media));
    setPreviewUrlByMediaId((current) => ({ ...current, ...result.previewUrlByMediaId }));
    for (const item of result.media) previewObjectKeyRef.current[item.id] = item.storageObjectKey;
  }

  function applyMediaAnalyzed(updated: Media) {
    cancelPendingFlush();
    setMedia((current) => mergeById(current, [updated]));
  }

  const contributorSubmissions = useMemo(
    () => submissions.filter((item) => item.source === "contributor"),
    [submissions],
  );
  const pendingSubmissions = useMemo(
    () => contributorSubmissions.filter((item) => item.status === "new"),
    [contributorSubmissions],
  );
  const approvedCount = contributorSubmissions.filter((item) => item.status === "approved").length;
  const excludedCount = contributorSubmissions.filter((item) => item.status === "excluded").length;
  const reviewedCount = approvedCount + excludedCount;
  const reviewProgress = contributorSubmissions.length > 0
    ? Math.round((reviewedCount / contributorSubmissions.length) * 100)
    : 0;
  const submissionStatusById = new Map(submissions.map((item) => [item.id, item.status]));
  const inventoryMedia = media
    .filter((item) => item.source === "owner" || !item.submissionId || submissionStatusById.get(item.submissionId) === "approved")
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const contributorNames = contributorSubmissions
    .map((submission) => submission.contributorName?.trim())
    .filter((name): name is string => Boolean(name));
  const isCollecting = roomStatus === "collecting";

  return (
    <>
      <div className="room-workspace-layout">
        <main className="room-workspace-main">
          <Surface className="room-snapshot" tone="quiet">
            <div className="room-snapshot__heading">
              <div>
                <p className="ui-eyebrow">ROOM SNAPSHOT</p>
                <h2>Konteks acara</h2>
              </div>
              <span className="room-snapshot__room-id">{roomId}</span>
            </div>

            <div className="room-snapshot__meta">
              <div className="room-snapshot__meta-item"><span>Dirayakan untuk</span><strong>{recipientName}</strong></div>
              <div className="room-snapshot__meta-item"><span>Acara</span><strong>{occasionName}</strong></div>
              <div className="room-snapshot__meta-item"><span>Tema</span><strong className="room-snapshot__theme"><i aria-hidden="true" />{themeName}</strong></div>
              <div className="room-snapshot__meta-item"><span>Batas pengumpulan</span><strong>{formatDate(collectionDeadline)}</strong><small>{deadlineHint(collectionDeadline, isCollecting)}</small></div>
            </div>
          </Surface>

          <Surface className="room-workspace-section room-workspace-review" tone="quiet">
            <div className="room-workspace-section__heading">
              <div>
                <p className="ui-eyebrow">SUBMISSION REVIEW</p>
                <h2>Kurasi kiriman contributor</h2>
                <p>Approve memindahkan media dari staging submission ke inventori permanen. Exclude menghapus file staging dari B2.</p>
                <span className={`workspace-sync-state ${syncError ? "is-error" : ""}`}>
                  <i aria-hidden="true" />{syncError ?? (syncActive ? "Auto-sync aktif · perubahan digabung sekitar 2,5 detik" : "Menyiapkan auto-sync...")}
                </span>
              </div>
              <Badge className={pendingSubmissions.length > 0 ? "ui-badge--amber" : "ui-badge--success"}>{pendingSubmissions.length} pending</Badge>
            </div>
            <SubmissionManager
              roomId={roomId}
              submissions={pendingSubmissions}
              media={media}
              previewUrlByMediaId={previewUrlByMediaId}
              onModerated={applyModeration}
            />
          </Surface>
        </main>

        <aside className="room-workspace-side">
          <Surface className={`room-collector-card ${isCollecting ? "room-collector-card--open" : ""}`} tone="elevated">
            <div className="room-collector-card__heading">
              <div><p className="ui-eyebrow">COLLECTOR</p><h2>Panel pengumpul</h2></div>
              <span className={`room-collector-card__signal ${isCollecting ? "is-open" : "is-closed"}`}><i aria-hidden="true" />{isCollecting ? "Aktif" : "Ditutup"}</span>
            </div>

            <div className="room-collector-card__count"><strong>{contributorSubmissions.length}</strong><span>kiriman masuk</span></div>

            <CollectorSharePanel
              roomId={roomId}
              collectorId={collectorId}
              collectorUrl={collectorUrl}
              isOpen={isCollecting}
              contributorNames={contributorNames}
              inventoryCount={inventoryMedia.length}
              onOpenInventory={() => setInventoryOpen(true)}
              onCollectionClosed={() => setRoomStatus("closed")}
            />
          </Surface>

          <Surface className="room-review-pulse" tone="quiet">
            <div className="room-review-pulse__heading">
              <div><p className="ui-eyebrow">REVIEW PULSE</p><h3>{reviewProgress}% selesai</h3></div>
              <span>{reviewedCount}/{contributorSubmissions.length}</span>
            </div>
            <div className="room-review-pulse__bar" aria-label={`${reviewProgress}% kiriman sudah direview`}><span style={{ width: `${reviewProgress}%` }} /></div>
            <div className="room-review-pulse__stats">
              <div><span className="room-review-pulse__icon"><InboxIcon size={15} /></span><small>Kiriman</small><strong>{contributorSubmissions.length}</strong></div>
              <div><span className="room-review-pulse__icon"><PhotoIcon size={15} /></span><small>Inventori</small><strong>{inventoryMedia.length}</strong></div>
              <div><span className="room-review-pulse__icon room-review-pulse__icon--success">✓</span><small>Approved</small><strong>{approvedCount}</strong></div>
              <div><span className="room-review-pulse__icon room-review-pulse__icon--amber">•</span><small>Pending</small><strong>{pendingSubmissions.length}</strong></div>
            </div>
          </Surface>

          <Surface className="room-deadline-card" tone="quiet">
            <span className="room-deadline-card__icon"><CalendarIcon size={17} /></span>
            <div><small>Collection deadline</small><strong>{formatDate(collectionDeadline)}</strong><span>{deadlineHint(collectionDeadline, isCollecting)}</span></div>
          </Surface>
        </aside>
      </div>

      <MediaInventoryDialog
        open={inventoryOpen}
        roomId={roomId}
        media={inventoryMedia}
        previewUrlByMediaId={previewUrlByMediaId}
        onClose={() => setInventoryOpen(false)}
        onOwnerUploaded={applyOwnerUpload}
        onMediaAnalyzed={applyMediaAnalyzed}
      />
    </>
  );
}
