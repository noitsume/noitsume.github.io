"use client";

import { useMemo, useRef, useState } from "react";
import type { Media, StagedSubmissionMedia, Submission } from "@/lib/data/contracts";
import { getCsrfToken } from "@/lib/auth/client";
import { Button, CheckIcon, PhotoIcon, TrashIcon, VideoIcon } from "@/components/ui";

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function analysisStatusLabel(item: StagedSubmissionMedia | Media) {
  if (item.analysisStatus === "ready") return "Petunjuk otomatis siap";
  return "Tetap bisa digunakan dalam cerita";
}

export function SubmissionManager({
  roomId,
  submissions,
  media,
  previewUrlByMediaId,
  onModerated,
}: {
  roomId: string;
  submissions: Submission[];
  media: Media[];
  previewUrlByMediaId: Record<string, string>;
  onModerated: (
    action: "approve" | "exclude" | "delete",
    submissionIds: string[],
    result: { promotedMedia: Media[]; previewUrlByMediaId: Record<string, string> },
  ) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);

  const availableSubmissionIds = useMemo(() => new Set(submissions.map((item) => item.id)), [submissions]);
  const activeSelected = useMemo(
    () => selected.filter((id) => availableSubmissionIds.has(id)),
    [availableSubmissionIds, selected],
  );

  async function runAction(action: "approve" | "exclude" | "delete", ids = activeSelected) {
    if (inFlightRef.current || ids.length === 0) return;
    if (action === "delete" && !window.confirm(`Hapus ${ids.length} kiriman beserta file aslinya?`)) return;

    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${roomId}/submissions/actions`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        credentials: "same-origin",
        body: JSON.stringify({ submissionIds: ids, action }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Submission gagal diperbarui.");

      setSelected((current) => current.filter((id) => !ids.includes(id)));
      onModerated(action, ids, {
        promotedMedia: (payload.data.promotedMedia ?? []) as Media[],
        previewUrlByMediaId: (payload.data.previewUrlByMediaId ?? {}) as Record<string, string>,
      });
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Aksi moderation gagal.");
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  }

  if (submissions.length === 0) {
    return (
      <div className="submission-empty">
        <span className="submission-empty__icon"><CheckIcon size={22} /></span>
        <h3>Semua kiriman sudah diperiksa.</h3>
        <p>Kiriman baru muncul otomatis di sini. Momen yang kamu terima dapat dilihat melalui tombol Lihat media.</p>
      </div>
    );
  }

  const allSelected = activeSelected.length === submissions.length;

  return (
    <div className="submission-manager">
      <div className="submission-toolbar">
        <label className="submission-toolbar__select-all">
          <input
            checked={allSelected}
            onChange={(event) => setSelected(event.target.checked ? submissions.map((item) => item.id) : [])}
            type="checkbox"
          />
          <span>{activeSelected.length > 0 ? `${activeSelected.length} dipilih` : "Pilih semua"}</span>
        </label>
        <div className="submission-toolbar__actions">
          <Button disabled={busy || activeSelected.length === 0} variant="secondary" onClick={() => runAction("approve")}><CheckIcon size={16} /> Terima</Button>
          <Button disabled={busy || activeSelected.length === 0} variant="ghost" onClick={() => runAction("exclude")}>Lewati</Button>
          <Button className="submission-action--danger" disabled={busy || activeSelected.length === 0} variant="ghost" onClick={() => runAction("delete")}><TrashIcon size={16} /> Hapus</Button>
        </div>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="submission-list">
        {submissions.map((submission) => {
          const submissionMedia: Array<StagedSubmissionMedia | Media> = submission.stagedMedia.length > 0
            ? submission.stagedMedia
            : submission.mediaIds.map((id) => mediaById.get(id)).filter((item): item is Media => Boolean(item));
          const checked = activeSelected.includes(submission.id);
          return (
            <article className={`submission-card ${checked ? "submission-card--selected" : ""}`} key={submission.id}>
              <header className="submission-card__header">
                <label className="submission-card__check"><input aria-label={`Pilih kiriman dari ${submission.contributorName || "Anonim"}`} disabled={busy} checked={checked} onChange={(event) => setSelected((current) => event.target.checked ? [...current, submission.id] : current.filter((id) => id !== submission.id))} type="checkbox" /></label>
                <div className="submission-card__identity">
                  <strong>{submission.contributorName || "Anonim"}</strong>
                  <span>{formatSubmittedAt(submission.submittedAt)} · {submissionMedia.length} media</span>
                </div>
                <span className="submission-status submission-status--new">Belum diperiksa</span>
              </header>

              {submission.message ? submission.message.length > 240 ? <details className="submission-wish"><summary>{submission.message.slice(0, 180)}… <span>Baca ucapan lengkap</span></summary><blockquote className="submission-card__message">{submission.message}</blockquote></details> : <blockquote className="submission-card__message">“{submission.message}”</blockquote> : null}

              {submissionMedia.length > 0 ? (
                <div className="submission-media-grid">
                  {submissionMedia.map((item) => {
                    const url = previewUrlByMediaId[item.id];
                    return (
                      <figure key={item.id} className="submission-media">
                        {url ? item.type === "photo" ? (
                          // Private B2 URL is short-lived and only generated for the authenticated owner workspace.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={item.originalFileName} src={url} />
                        ) : (
                          <video controls playsInline preload="metadata" src={url} />
                        ) : (
                          <span className="submission-media__loading">{item.type === "photo" ? <PhotoIcon size={18} /> : <VideoIcon size={18} />}<small>Menyiapkan preview...</small></span>
                        )}
                        <figcaption>
                          <span>{item.type === "photo" ? <PhotoIcon size={13} /> : <VideoIcon size={13} />}{item.originalFileName}</span>
                        </figcaption>
                        {item.mediaIntelligence?.scene ? (
                          <details className="submission-media__intelligence"><summary>Petunjuk cerita otomatis</summary>
                            <small>{analysisStatusLabel(item)}</small>
                            <p>{item.mediaIntelligence.scene}</p>
                          </details>
                        ) : null}
                      </figure>
                    );
                  })}
                </div>
              ) : null}

              <footer className="submission-card__footer">
                <Button disabled={busy} variant="secondary" onClick={() => runAction("approve", [submission.id])}>Terima</Button>
                <Button disabled={busy} variant="ghost" onClick={() => runAction("exclude", [submission.id])}>Lewati</Button>
                <Button className="submission-action--danger" disabled={busy} variant="ghost" onClick={() => runAction("delete", [submission.id])}>Hapus</Button>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
