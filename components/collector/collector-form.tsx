"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  COLLECTOR_ACCEPT,
  COLLECTOR_MAX_FILES,
  COLLECTOR_MAX_IMAGE_BYTES,
  COLLECTOR_MAX_VIDEO_BYTES,
  collectorMediaRules,
} from "@/lib/collector/constants";
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

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function validateFiles(files: File[]) {
  if (files.length > COLLECTOR_MAX_FILES) return `Maksimal ${COLLECTOR_MAX_FILES} file per submission.`;
  for (const file of files) {
    const rule = collectorMediaRules[file.type as keyof typeof collectorMediaRules];
    if (!rule) return `${file.name}: format belum didukung.`;
    const max = rule.type === "photo" ? COLLECTOR_MAX_IMAGE_BYTES : COLLECTOR_MAX_VIDEO_BYTES;
    if (file.size > max) return `${file.name}: ${rule.type === "photo" ? "foto maksimal 20 MB" : "video maksimal 200 MB"}.`;
  }
  return null;
}

export function CollectorForm({ collectorId, recipientName }: { collectorId: string; recipientName: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const submitInFlightRef = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"idle" | "processing" | "preparing" | "uploading" | "saving" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "processing" || phase === "preparing" || phase === "uploading" || phase === "saving";

  function addFiles(selected: File[]) {
    const next = [...files, ...selected].slice(0, COLLECTOR_MAX_FILES);
    const validation = validateFiles(next);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setFiles(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    setError(null);

    if (!message.trim() && files.length === 0) {
      setError("Tulis pesan atau tambahkan minimal satu foto/video.");
      return;
    }

    const validation = validateFiles(files);
    if (validation) {
      setError(validation);
      return;
    }

    submitInFlightRef.current = true;
    try {
      let submissionId: string | undefined;
      let uploads: PreparedUpload[] = [];
      const analysisInputs: Array<MediaAnalysisInput | undefined> = [];

      if (files.length > 0) {
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

        setPhase("preparing");
        const presignResponse = await fetch(`/api/collector/${encodeURIComponent(collectorId)}/upload-urls`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            files: files.map((file) => ({
              name: file.name,
              contentType: file.type,
              sizeBytes: file.size,
            })),
          }),
        });
        const presignPayload = await presignResponse.json();
        if (!presignResponse.ok || !presignPayload?.ok) {
          throw new Error(presignPayload?.error?.message ?? "Gagal menyiapkan upload.");
        }

        submissionId = presignPayload.data.submissionId;
        uploads = presignPayload.data.uploads;
        setPhase("uploading");
        setProgress(0);

        for (let index = 0; index < uploads.length; index += 1) {
          const upload = uploads[index];
          const file = files[index];
          const uploadResponse = await fetch(upload.uploadUrl, {
            method: "PUT",
            headers: { "content-type": upload.contentType },
            body: file,
          });
          if (!uploadResponse.ok) throw new Error(`Upload ${file.name} gagal. Coba lagi.`);
          setProgress(index + 1);
        }
      }

      setPhase("saving");
      const submitResponse = await fetch(`/api/collector/${encodeURIComponent(collectorId)}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          submissionId,
          contributorName: name.trim() || null,
          message: message.trim() || null,
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
      const submitPayload = await submitResponse.json();
      if (!submitResponse.ok || !submitPayload?.ok) {
        throw new Error(submitPayload?.error?.message ?? "Ucapan belum berhasil disimpan.");
      }

      setFiles([]);
      setMessage("");
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
      setPhase("done");
    } catch (submitError) {
      setPhase("idle");
      setError(submitError instanceof Error ? submitError.message : "Submission gagal. Coba lagi.");
    } finally {
      submitInFlightRef.current = false;
    }
  }

  if (phase === "done") {
    return (
      <div className="collector-success" role="status">
        <span className="collector-success__icon"><CheckIcon size={28} /></span>
        <p className="ui-eyebrow">TERKIRIM</p>
        <h2>Kenanganmu sudah masuk.</h2>
        <p>Terima kasih sudah ikut menyiapkan sesuatu untuk {recipientName}. Owner Room akan mereview kirimanmu.</p>
        <button className="ui-button ui-button--secondary" type="button" onClick={() => setPhase("idle")}>Kirim kenangan lain</button>
      </div>
    );
  }

  return (
    <form className="collector-form" onSubmit={submit}>
      <label className="form-field">
        <span>Namamu <small>opsional</small></span>
        <input
          autoComplete="name"
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="Contoh: Dimas"
          value={name}
        />
      </label>

      <label className="form-field">
        <span>Ucapan untuk {recipientName} <small>opsional jika ada media</small></span>
        <textarea
          maxLength={3000}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Tulis sesuatu yang ingin kamu sampaikan..."
          rows={5}
          value={message}
        />
        <small className="collector-form__counter">{message.length} / 3000</small>
      </label>

      <div className="collector-upload-field">
        <div className="collector-upload-field__label">
          <span>Foto / Video <small>opsional jika ada ucapan</small></span>
          <span>{files.length} / {COLLECTOR_MAX_FILES}</span>
        </div>
        <button
          className="collector-dropzone"
          disabled={busy || files.length >= COLLECTOR_MAX_FILES}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <span className="collector-dropzone__icon"><UploadIcon size={22} /></span>
          <strong>Pilih foto atau video</strong>
          <span>JPG, PNG, WebP hingga 20 MB · MP4, WebM, MOV hingga 200 MB</span>
        </button>
        <input
          accept={COLLECTOR_ACCEPT}
          className="collector-file-input"
          disabled={busy}
          multiple
          onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
          ref={inputRef}
          type="file"
        />
      </div>

      {files.length > 0 ? (
        <ul className="collector-file-list">
          {files.map((file, index) => {
            const isVideo = file.type.startsWith("video/");
            return (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <span className="collector-file-list__type">{isVideo ? <VideoIcon size={17} /> : <PhotoIcon size={17} />}</span>
                <div><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
                <button
                  aria-label={`Hapus ${file.name}`}
                  disabled={busy}
                  onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  type="button"
                ><CloseIcon size={16} /></button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {busy ? (
        <div className="collector-progress" role="status">
          <div><span>{phase === "processing" ? `Memahami media di perangkat ${progress} / ${files.length}` : phase === "preparing" ? "Menyiapkan upload..." : phase === "uploading" ? `Mengunggah ${progress} / ${files.length}` : "Menganalisis & menyimpan kiriman..."}</span></div>
          <span className="collector-progress__bar"><i style={{ width: (phase === "processing" || phase === "uploading") && files.length > 0 ? `${Math.max(8, (progress / files.length) * 100)}%` : phase === "saving" ? "100%" : "18%" }} /></span>
        </div>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <button className="ui-button ui-button--primary collector-form__submit" disabled={busy} type="submit">
        {busy ? "Sedang mengirim..." : "Kirim untuk Kenangin"}
      </button>
      <p className="collector-form__privacy">Original media dikirim langsung ke penyimpanan privat Kenangin. Browser hanya membuat proxy kecil untuk memahami suasana media; kiriman tetap valid walau analisis AI gagal.</p>
    </form>
  );
}
