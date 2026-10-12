"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ensureFirestoreReadSession, getCsrfToken } from "@/lib/auth/client";
import { mediaSchema, submissionSchema, type Media, type RoomStatus, type Submission } from "@/lib/data/contracts";
import { getFirebaseClientFirestore } from "@/lib/firebase/client";
import Link from "next/link";
import { workspaceGuidance } from "@/lib/domain/journey";
import { CollectorSharePanel } from "./collector-share-panel";
import { MediaInventoryDialog } from "./media-inventory";
import { SubmissionManager } from "./submission-manager";
import type { ModerationResult } from "@/lib/collector/moderation-result";

const SYNC_BATCH_WINDOW_MS = 2500;

type WorkspaceData = {
  submissions: Submission[];
  media: Media[];
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
    moderation: data.moderation ?? null,
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
  const [studioStarting, setStudioStarting] = useState(false);
  const [studioError, setStudioError] = useState<string | null>(null);
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
      } catch {
        if (!disposed) setSyncError("Pembaruan langsung terputus. Kiriman akan diperiksa ulang setiap 30 detik.");
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

  useEffect(() => {
    if (!syncError) return;
    let disposed = false;
    let running = false;
    const poll = async () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      try {
        const response = await fetch("/api/rooms/" + encodeURIComponent(roomId) + "/workspace", { cache: "no-store" });
        const payload = await response.json();
        if (disposed || !response.ok || !payload.ok) return;
        setSubmissions(payload.data.workspace.submissions);
        setMedia(payload.data.workspace.media);
        setPreviewUrlByMediaId(payload.data.workspace.previewUrlByMediaId);
        setRoomStatus(payload.data.room.status);
      } catch { /* Keep the last successfully loaded workspace visible. */ }
      finally { running = false; }
    };
    const timer = window.setInterval(() => void poll(), 30000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [roomId, syncError]);

  function cancelPendingFlush() {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    flushVersionRef.current += 1;
  }

  function applyModeration(result: ModerationResult) {
    cancelPendingFlush();
    const removedSubmissions = new Set(result.deletedSubmissionIds);
    const reviewedIds = new Set([...result.reviewedSubmissions.map(item => item.id), ...result.deletedSubmissionIds]);
    const acceptedIds = new Set(result.promotedMedia.map(item => item.id));
    const removedIds = new Set(result.removedMediaIds);
    // A retried response may arrive after Firestore already cleared staging.
    // Also clear local transient items from the original submission snapshot.
    for (const item of submissions.filter(item => reviewedIds.has(item.id))) {
      for (const id of [...item.mediaIds, ...item.stagedMedia.map(media => media.id)]) {
        if (!acceptedIds.has(id)) removedIds.add(id);
      }
    }
    const mergeSubmissions = (current: Submission[]) => mergeById(current.filter(item => !removedSubmissions.has(item.id)), result.reviewedSubmissions);
    const mergeMedia = (current: Media[]) => mergeById(current.filter(item => !removedIds.has(item.id)), result.promotedMedia);
    stagedSubmissions.current = mergeSubmissions(stagedSubmissions.current);
    stagedMedia.current = mergeMedia(stagedMedia.current);
    setSubmissions(mergeSubmissions);
    setMedia(mergeMedia);
    setPreviewUrlByMediaId(current => ({ ...Object.fromEntries(Object.entries(current).filter(([id]) => !removedIds.has(id))), ...result.previewUrlByMediaId }));
    for (const id of removedIds) delete previewObjectKeyRef.current[id];
    for (const item of result.promotedMedia) previewObjectKeyRef.current[item.id] = item.storageObjectKey;
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

  async function enterStudio() {
    if (studioStarting) return;
    setStudioError(null);

    if (roomStatus === "configuring") {
      router.push(`/rooms/${encodeURIComponent(roomId)}/studio`);
      return;
    }
    if (roomStatus !== "closed" && roomStatus !== "ready") return;

    setStudioStarting(true);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/studio/start`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Settings Studio belum dapat dibuka.");
      }
      roomStatusRef.current = "configuring";
      setRoomStatus("configuring");
      router.push(`/rooms/${encodeURIComponent(roomId)}/studio`);
      router.refresh();
    } catch (error) {
      setStudioError(error instanceof Error ? error.message : "Settings Studio belum dapat dibuka.");
    } finally {
      setStudioStarting(false);
    }
  }

  const contributorSubmissions = useMemo(
    () => submissions.filter((item) => item.source === "contributor"),
    [submissions],
  );
  const pendingSubmissions = useMemo(
    () => contributorSubmissions.filter((item) => item.status === "new"),
    [contributorSubmissions],
  );
  const approvedCount = contributorSubmissions.filter(item => item.status === "approved").length;
  const statuses = new Map(submissions.map(item => [item.id, item.status]));
  const inventoryMedia = media.filter(item => item.source === "owner" || !item.submissionId || statuses.get(item.submissionId) === "approved");
  const contributorNames = contributorSubmissions.map(item => item.contributorName?.trim()).filter((name): name is string => Boolean(name));
  const isCollecting = roomStatus === "collecting";
  const canContinue = roomStatus === "configuring" || roomStatus === "ready" || (roomStatus === "closed" && pendingSubmissions.length === 0);
  const guidance = workspaceGuidance(roomStatus, pendingSubmissions.length, inventoryMedia.length);
  const base = "/rooms/" + encodeURIComponent(roomId);
  const guidanceAction = guidance.action === "finish" ? <Link className="ui-button ui-button--primary" href={base + "/finish"}>Bagikan kejutan →</Link>
    : guidance.action === "bake" ? <Link className="ui-button ui-button--primary" href={base + "/bake"}>Lihat penerbitan →</Link>
    : guidance.action === "studio" ? <button className="ui-button ui-button--primary" disabled={studioStarting} onClick={enterStudio}>{studioStarting ? "Membuka…" : "Lanjut ke Studio →"}</button>
    : guidance.action === "upload" ? <button className="ui-button ui-button--primary" onClick={() => setInventoryOpen(true)}>Tambahkan momen +</button>
    : <a className="ui-button ui-button--primary" href={guidance.action === "review" ? "#review-kiriman" : "#pengumpulan"}>{guidance.action === "review" ? "Pilih kiriman ↓" : "Atur pengumpulan ↓"}</a>;

  return <>
    <section className="workspace-guidance" aria-labelledby="next-task">
      <div><p className="ui-eyebrow">LANGKAH BERIKUTNYA</p><h2 id="next-task">{guidance.title}</h2><p>{guidance.detail}</p>
        <div className="workspace-metrics"><span><strong>{contributorSubmissions.length}</strong> kiriman</span><span><strong>{approvedCount}</strong> diterima</span><span><strong>{inventoryMedia.length}</strong> media siap</span></div>
      </div>{guidanceAction}
    </section>
    <div className="workspace-columns">
      <div className="workspace-main">
        <div className="workspace-panel workspace-uploads"><div><strong>Momen pilihanmu</strong><small>Foto dan video yang diterima, termasuk milikmu sendiri.</small></div><button className="ui-button ui-button--secondary" onClick={() => setInventoryOpen(true)}>Lihat {inventoryMedia.length} media</button></div>
        <section className="workspace-panel workspace-review" id="review-kiriman" aria-labelledby="review-heading">
          <p className="ui-eyebrow">DARI ORANG TERDEKAT</p><h2 id="review-heading">Kiriman untuk {recipientName}</h2>
          <p>Pilih Terima untuk memasukkan kiriman ke cerita. Kiriman yang dilewati tidak akan ditampilkan.</p>
          <p className="workspace-sync-state" role="status">{syncError ?? (syncActive ? "● Kiriman diperbarui otomatis" : "Menghubungkan pembaruan…")}{syncError ? <button className="ui-button ui-button--ghost" onClick={() => window.location.reload()}>Muat ulang</button> : null}</p>
          <SubmissionManager roomId={roomId} submissions={pendingSubmissions} media={media} previewUrlByMediaId={previewUrlByMediaId} onModerated={applyModeration} />
        </section>
      </div>
      <aside className="workspace-aside">
        <section className="workspace-panel" id="pengumpulan"><p className="ui-eyebrow">{isCollecting ? "PENGUMPULAN AKTIF" : "PENGUMPULAN SELESAI"}</p><h3>{isCollecting ? "Ajak mereka ikut bercerita" : "Semua momen sudah terkumpul"}</h3><p>{isCollecting ? "Bagikan tautan ini kepada teman dan keluarga. Mereka bisa mengirim tanpa akun." : "Tautan pengumpulan sudah ditutup. Kamu masih bisa menambahkan media sendiri melalui Lihat media."}</p>
          <CollectorSharePanel roomId={roomId} collectorId={collectorId} collectorUrl={collectorUrl} isOpen={isCollecting} contributorNames={contributorNames} inventoryCount={inventoryMedia.length} onOpenInventory={() => setInventoryOpen(true)} onCollectionClosed={() => setRoomStatus("closed")} />
        </section>
        <details className="workspace-panel workspace-details"><summary>Detail kenangan</summary><dl><dt>Penerima</dt><dd>{recipientName}</dd><dt>Acara & suasana</dt><dd>{occasionName} · {themeName}</dd><dt>Batas pengumpulan</dt><dd>{formatDate(collectionDeadline)}<br />{deadlineHint(collectionDeadline, isCollecting)}</dd></dl><Link className="journey-back" href={base + "/edit"}>Ubah detail →</Link></details>
      </aside>
    </div>
    {studioError ? <p className="form-error" role="alert">{studioError}</p> : null}
    <div className="journey-actionbar"><div className="journey-actionbar__copy"><strong>{canContinue ? "Siap merangkai cerita" : "Sebelum masuk Studio"}</strong><small>{isCollecting ? "Tutup pengumpulan setelah semua kiriman masuk." : pendingSubmissions.length ? pendingSubmissions.length + " kiriman perlu dipilih." : inventoryMedia.length ? "Pilihan media dan musik tersimpan di setiap langkah." : "Mulai dari section Teks, atau tambahkan foto dan video."}</small></div><div className="journey-actionbar__buttons"><Link className="ui-button ui-button--ghost" href="/dashboard">← Kenangan saya</Link><button className="ui-button ui-button--primary" disabled={!canContinue || studioStarting} onClick={enterStudio}>{studioStarting ? "Membuka…" : roomStatus === "ready" ? "Ubah cerita" : "Lanjut ke Studio →"}</button></div></div>
    <MediaInventoryDialog open={inventoryOpen} roomId={roomId} media={inventoryMedia} previewUrlByMediaId={previewUrlByMediaId} onClose={() => setInventoryOpen(false)} onOwnerUploaded={applyOwnerUpload} onMediaAnalyzed={applyMediaAnalyzed} />
  </>;
}
