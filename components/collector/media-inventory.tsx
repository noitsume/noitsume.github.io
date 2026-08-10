"use client";

import { useEffect, useRef, useState } from "react";
import type { Media } from "@/lib/data/contracts";
import {
  COLLECTOR_ACCEPT,
  COLLECTOR_MAX_FILES,
  COLLECTOR_MAX_IMAGE_BYTES,
  COLLECTOR_MAX_VIDEO_BYTES,
  collectorMediaRules,
} from "@/lib/collector/constants";
import { getCsrfToken } from "@/lib/auth/client";
import { CheckIcon, CloseIcon, PhotoIcon, UploadIcon, VideoIcon } from "@/components/ui";
import { fitAnalysisBatchBudget, preprocessMediaFile } from "@/lib/media-intelligence/client-preprocess";
import type { MediaAnalysisInput } from "@/lib/media-intelligence/contracts";

type PreparedUpload = {
  mediaId: string;
  objectKey: string;
  uploadUrl: string;
  contentType: string;
  sizeBytes: number;
  originalFileName: string;
  type: "photo" | "video";
};

type OwnerUploadResult = {
  media: Media[];
  previewUrlByMediaId: Record<string, string>;
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function analysisFailureLabel(code: string | null) {
  if (code === "gemini_timeout") return "Gemini melewati batas waktu Quick Look.";
  if (code === "gemini_unavailable") return "Gemini sementara tidak tersedia.";
  if (code === "invalid_output") return "Output Gemini tidak lolos schema.";
  if (code === "proxy_missing") return "Proxy analisis tidak tersedia.";
  if (code === "preprocess_failed") return "Browser tidak berhasil menyiapkan proxy analisis.";
  return null;
}

function validateFiles(files: File[]) {
  if (files.length > COLLECTOR_MAX_FILES) return `Maksimal ${COLLECTOR_MAX_FILES} file per upload.`;
  for (const file of files) {
    const rule = collectorMediaRules[file.type as keyof typeof collectorMediaRules];
    if (!rule) return `${file.name}: format belum didukung.`;
    const max = rule.type === "photo" ? COLLECTOR_MAX_IMAGE_BYTES : COLLECTOR_MAX_VIDEO_BYTES;
    if (file.size > max) return `${file.name}: ${rule.type === "photo" ? "foto maksimal 20 MB" : "video maksimal 200 MB"}.`;
  }
  return null;
}

export function MediaInventoryDialog({
  open,
  roomId,
  media,
  previewUrlByMediaId,
  onClose,
  onOwnerUploaded,
  onMediaAnalyzed,
}: {
  open: boolean;
  roomId: string;
  media: Media[];
  previewUrlByMediaId: Record<string, string>;
  onClose: () => void;
  onOwnerUploaded: (result: OwnerUploadResult) => void;
  onMediaAnalyzed: (media: Media) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "processing" | "preparing" | "uploading" | "saving">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [analyzingMediaId, setAnalyzingMediaId] = useState<string | null>(null);

  const ownerCount = media.filter((item) => item.source === "owner").length;
  const intelligenceReadyCount = media.filter((item) => item.analysisStatus === "ready").length;
  const intelligenceFallbackCount = media.filter((item) => item.analysisStatus === "fallback" || item.analysisStatus === "not_started").length;
  const busy = phase !== "idle" || Boolean(analyzingMediaId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function selectFiles(selected: File[]) {
    const next = selected.slice(0, COLLECTOR_MAX_FILES);
    const validation = validateFiles(next);
    if (validation) {
      setError(validation);
      return;
    }
    setFiles(next);
    setError(null);
    setSuccess(null);
  }

  async function uploadOwnerMedia() {
    if (uploadInFlightRef.current || files.length === 0) return;
    const validation = validateFiles(files);
    if (validation) {
      setError(validation);
      return;
    }

    uploadInFlightRef.current = true;
    setError(null);
    setSuccess(null);
    try {
      const analysisInputs: Array<MediaAnalysisInput | undefined> = [];
      setPhase("processing");
      setProgress(0);
      for (let index = 0; index < files.length; index += 1) {
        try {
          analysisInputs[index] = await preprocessMediaFile(files[index], "quick_look");
        } catch {
          analysisInputs[index] = undefined;
        }
        setProgress(index + 1);
      }
      const budgetedAnalysisInputs = fitAnalysisBatchBudget(analysisInputs);
      analysisInputs.splice(0, analysisInputs.length, ...budgetedAnalysisInputs);

      const csrfToken = await getCsrfToken();
      setPhase("preparing");
      const presignResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media/upload-urls`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({
          files: files.map((file) => ({ name: file.name, contentType: file.type, sizeBytes: file.size })),
        }),
      });
      const presignPayload = await presignResponse.json();
      if (!presignResponse.ok || !presignPayload?.ok) {
        throw new Error(presignPayload?.error?.message ?? "Gagal menyiapkan upload owner.");
      }

      const uploads = presignPayload.data.uploads as PreparedUpload[];
      setPhase("uploading");
      setProgress(0);

      for (let index = 0; index < uploads.length; index += 1) {
        const upload = uploads[index];
        const file = files[index];
        const response = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "content-type": upload.contentType },
          body: file,
        });
        if (!response.ok) throw new Error(`Upload ${file.name} gagal. Coba lagi.`);
        setProgress(index + 1);
      }

      setPhase("saving");
      const commitResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media/commit`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({
          media: uploads.map((upload, index) => ({
            id: upload.mediaId,
            objectKey: upload.objectKey,
            originalFileName: upload.originalFileName,
            contentType: upload.contentType,
            sizeBytes: upload.sizeBytes,
            type: upload.type,
            analysis: analysisInputs[index],
          })),
        }),
      });
      const commitPayload = await commitResponse.json();
      if (!commitResponse.ok || !commitPayload?.ok) {
        throw new Error(commitPayload?.error?.message ?? "Media owner belum berhasil disimpan.");
      }

      onOwnerUploaded(commitPayload.data as OwnerUploadResult);
      setFiles([]);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess(`${uploads.length} media ditambahkan ke inventori dan otomatis approved.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload owner gagal.");
    } finally {
      setPhase("idle");
      uploadInFlightRef.current = false;
    }
  }

  async function reanalyzeMedia(item: Media, mode: "quick_look" | "deep") {
    if (analyzingMediaId) return;
    const url = previewUrlByMediaId[item.id];
    if (!url) {
      setError("Preview private media belum siap untuk analisis ulang.");
      return;
    }
    setAnalyzingMediaId(item.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Original media tidak dapat dibaca dari B2.");
      const blob = await response.blob();
      const file = new File([blob], item.originalFileName, { type: item.contentType });
      const analysis = await preprocessMediaFile(file, mode);
      const csrfToken = await getCsrfToken();
      const analyzeResponse = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({ mediaId: item.id, analysis }),
      });
      const payload = await analyzeResponse.json();
      if (!analyzeResponse.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Analisis media gagal.");
      onMediaAnalyzed(payload.data.media as Media);
      setSuccess(mode === "deep" ? "Deep Analysis selesai." : "Media Intelligence berhasil diperbarui.");
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analisis media gagal.");
    } finally {
      setAnalyzingMediaId(null);
    }
  }

  return (
    <dialog
      aria-labelledby="media-inventory-title"
      className="media-inventory-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      onClose={() => {
        if (open && !busy) onClose();
      }}
      ref={dialogRef}
    >
      <div className="media-inventory__header">
        <div>
          <p className="ui-eyebrow">MEDIA INVENTORY</p>
          <h2 id="media-inventory-title">Inventori media Room</h2>
          <p>Berisi media contributor yang sudah di-approve dan semua media yang kamu upload sendiri.</p>
        </div>
        <button aria-label="Tutup inventori" className="media-inventory__close" disabled={busy} onClick={onClose} type="button"><CloseIcon size={18} /></button>
      </div>

      <div className="media-inventory__body">
        <section className="owner-upload-panel">
          <div className="owner-upload-panel__heading">
            <div>
              <strong>Tambah media milikmu</strong>
              <span>Upload owner langsung masuk inventori sebagai approved.</span>
            </div>
            <button className="ui-button ui-button--secondary" disabled={busy} onClick={() => fileInputRef.current?.click()} type="button"><UploadIcon size={15} /> <span>Pilih Media</span></button>
          </div>
          <input
            accept={COLLECTOR_ACCEPT}
            className="collector-file-input"
            disabled={busy}
            multiple
            onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
            ref={fileInputRef}
            type="file"
          />

          {files.length > 0 ? (
            <div className="owner-upload-panel__selection">
              <div className="owner-upload-panel__files">
                {files.map((file) => (
                  <span key={`${file.name}-${file.lastModified}`}><i>{file.type.startsWith("video/") ? <VideoIcon size={13} /> : <PhotoIcon size={13} />}</i>{file.name}<small>{formatBytes(file.size)}</small></span>
                ))}
              </div>
              <button className="ui-button ui-button--primary" disabled={busy} onClick={uploadOwnerMedia} type="button">
                <UploadIcon size={15} /> <span>{phase !== "idle" ? phase === "processing" ? `Memahami ${progress}/${files.length}` : phase === "uploading" ? `Upload ${progress}/${files.length}` : phase === "saving" ? "Menganalisis..." : "Menyiapkan..." : `Upload ${files.length} Media`}</span>
              </button>
            </div>
          ) : null}

          {phase !== "idle" ? <span className="owner-upload-panel__progress"><i style={{ width: (phase === "processing" || phase === "uploading") && files.length > 0 ? `${Math.max(8, (progress / files.length) * 100)}%` : phase === "saving" ? "100%" : "16%" }} /></span> : null}
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {success ? <p className="media-inventory__success" role="status"><CheckIcon size={14} />{success}</p> : null}
        </section>

        <div className="media-inventory__summary">
          <div><strong>{media.length}</strong><span>Total media</span></div>
          <div><strong>{intelligenceReadyCount}</strong><span>AI ready</span></div>
          <div><strong>{intelligenceFallbackCount}</strong><span>Perlu analisis</span></div>
          <div><strong>{ownerCount}</strong><span>Upload owner</span></div>
        </div>

        {media.length === 0 ? (
          <div className="media-inventory__empty">
            <span><PhotoIcon size={24} /></span>
            <strong>Inventori masih kosong.</strong>
            <p>Approve kiriman contributor atau upload media milikmu sendiri.</p>
          </div>
        ) : (
          <div className="media-inventory__grid">
            {media.map((item) => {
              const url = previewUrlByMediaId[item.id];
              return (
                <article className="media-inventory-card" key={item.id}>
                  <div className="media-inventory-card__preview">
                    {url ? item.type === "photo" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={item.originalFileName} src={url} />
                    ) : (
                      <video controls playsInline preload="metadata" src={url} />
                    ) : (
                      <span className="media-inventory-card__loading">{item.type === "photo" ? <PhotoIcon size={20} /> : <VideoIcon size={20} />}<small>Menyiapkan preview...</small></span>
                    )}
                    <span className={`media-inventory-card__source media-inventory-card__source--${item.source}`}>{item.source === "owner" ? "Owner" : "Contributor"}</span>
                  </div>
                  <div className="media-inventory-card__meta">
                    <div className="media-inventory-card__title-row">
                      <strong title={item.originalFileName}>{item.originalFileName}</strong>
                      <span className={`media-ai-status media-ai-status--${item.analysisStatus}`}>{item.analysisStatus === "ready" ? "AI ready" : item.analysisStatus === "fallback" ? "Fallback" : item.analysisStatus === "processing" ? "Analyzing" : "Belum"}</span>
                    </div>
                    <span>{item.source === "owner" ? "Upload kamu" : item.contributorName || "Contributor anonim"}</span>
                    {item.mediaIntelligence?.scene ? <p className="media-inventory-card__scene">{item.mediaIntelligence.scene}</p> : null}
                    {item.analysisStatus === "fallback" && analysisFailureLabel(item.analysisFailureCode) ? (
                      <p className="media-inventory-card__analysis-note">{analysisFailureLabel(item.analysisFailureCode)} Original media tetap aman; coba analisis ulang.</p>
                    ) : null}
                    {(item.analysisStatus === "fallback" || item.analysisStatus === "not_started" || item.needsDeepAnalysis) && url ? (
                      <button
                        className="media-ai-action"
                        disabled={Boolean(analyzingMediaId)}
                        onClick={() => reanalyzeMedia(item, item.analysisStatus === "ready" ? "deep" : "quick_look")}
                        type="button"
                      >
                        {analyzingMediaId === item.id ? "Menganalisis..." : item.analysisStatus === "ready" ? "Deep Analysis" : "Coba analisis lagi"}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </dialog>
  );
}
