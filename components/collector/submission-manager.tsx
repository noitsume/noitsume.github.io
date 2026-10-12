"use client";

import { useMemo, useRef, useState } from "react";
import type { Media, StagedSubmissionMedia, Submission, SubmissionModeration } from "@/lib/data/contracts";
import type { ModerationResult } from "@/lib/collector/moderation-result";
import { getCsrfToken } from "@/lib/auth/client";
import { Button, CheckIcon, PhotoIcon, TrashIcon, VideoIcon } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";

type ReviewMedia = StagedSubmissionMedia | Media;
type Review = { submission: Submission; items: ReviewMedia[]; decision: SubmissionModeration };

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 KB";
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024)).toLocaleString("id-ID")} KB`;
}

export function SubmissionManager({ roomId, submissions, media, previewUrlByMediaId, onModerated }: {
  roomId: string;
  submissions: Submission[];
  media: Media[];
  previewUrlByMediaId: Record<string, string>;
  onModerated: (result: ModerationResult) => void;
}) {
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState<Record<string, SubmissionModeration>>({});
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ submissionId: string; mediaId: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRequest = useRef(0);
  const inFlightRef = useRef(false);
  const mediaById = useMemo(() => new Map(media.map(item => [item.id, item])), [media]);
  function itemsFor(submission: Submission): ReviewMedia[] {
    return submission.stagedMedia.length > 0 ? submission.stagedMedia : submission.mediaIds.map(id => mediaById.get(id)).filter((item): item is Media => Boolean(item));
  }
  function decisionFor(submission: Submission) { return submission.moderation ?? pending[submission.id]; }
  function selectedFor(submission: Submission, items: ReviewMedia[]) {
    return decisionFor(submission)?.acceptedMediaIds ?? choices[submission.id] ?? items.map(item => item.id);
  }
  function toggle(submission: Submission, items: ReviewMedia[], mediaId: string, checked: boolean) {
    const selected = selectedFor(submission, items);
    setChoices(current => ({ ...current, [submission.id]: checked ? [...new Set([...selected, mediaId])] : selected.filter(id => id !== mediaId) }));
  }
  function requestReview(submission: Submission, action: "approve" | "delete") {
    setError(null);
    const items = itemsFor(submission);
    setReview({ submission, items, decision: decisionFor(submission) ?? { action, acceptedMediaIds: action === "approve" ? selectedFor(submission, items) : [] } });
  }
  async function saveReview() {
    if (inFlightRef.current || !review) return;
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    setPending(current => ({ ...current, [review.submission.id]: review.decision }));
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/submissions/actions`, {
        method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, credentials: "same-origin",
        body: JSON.stringify({ submissionIds: [review.submission.id], action: review.decision.action, ...(review.decision.action === "approve" ? { acceptedMediaIds: review.decision.acceptedMediaIds } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Pilihan belum selesai disimpan. Lanjutkan penyimpanan untuk mencoba lagi.");
      onModerated(payload.data as ModerationResult);
      const accepted = review.decision.acceptedMediaIds.length;
      setNotice(review.decision.action === "delete" ? "Kiriman dan seluruh medianya telah dihapus." : `${accepted} media diterima, ${review.items.length - accepted} media dihapus.${review.submission.message ? " Ucapan disimpan." : ""}`);
      setReview(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Penyimpanan terputus. Lanjutkan penyimpanan untuk mencoba lagi.");
    } finally { setBusy(false); inFlightRef.current = false; }
  }
  async function openPreview(submissionId: string, item: ReviewMedia) {
    const requestId = ++previewRequest.current;
    setPreview({ submissionId, mediaId: item.id });
    setPreviewUrl(null);
    setPreviewError(null);
    try {
      // Refresh on open: a thumbnail can outlive its 15-minute signed URL.
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/media/preview-urls`, {
        method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, credentials: "same-origin",
        body: JSON.stringify({ media: [{ id: item.id, objectKey: item.storageObjectKey }] }),
      });
      const payload = await response.json();
      const url = payload.data?.previewUrlByMediaId?.[item.id];
      if (!response.ok || !payload.ok || !url) throw new Error("Preview belum dapat dibuka. Coba muat ulang preview.");
      if (requestId === previewRequest.current) setPreviewUrl(url);
    } catch (previewFailure) {
      if (requestId === previewRequest.current) setPreviewError(previewFailure instanceof Error ? previewFailure.message : "Preview belum tersedia.");
    }
  }
  function closePreview() { previewRequest.current++; setPreview(null); setPreviewUrl(null); }
  const previewSubmission = submissions.find(item => item.id === preview?.submissionId);
  const previewItems = previewSubmission ? itemsFor(previewSubmission) : [];
  const previewIndex = previewItems.findIndex(item => item.id === preview?.mediaId);
  const previewItem = previewItems[previewIndex];
  const rejectedItems = review?.items.filter(item => !review.decision.acceptedMediaIds.includes(item.id)) ?? [];

  return <div className="submission-manager">
    {notice ? <p className="studio-feedback studio-feedback--success" role="status"><CheckIcon size={16} />{notice}</p> : null}
    {error && !review ? <p className="form-error" role="alert">{error}</p> : null}
    {submissions.length === 0 ? <div className="submission-empty"><span className="submission-empty__icon"><CheckIcon size={22} /></span><h3>Semua kiriman sudah diperiksa.</h3><p>Kiriman baru muncul otomatis di sini. Momen yang diterima tersedia di Lihat media.</p></div> : <>
      <div className="submission-review-intro"><CheckIcon size={18} /><p><strong>Centang momen yang ingin kamu simpan.</strong><span>Buka preview untuk melihat foto utuh atau memutar video. Media tanpa centang dihapus saat kamu menyimpan pilihan kiriman tersebut.</span></p></div>
      <div className="submission-list">{submissions.map(submission => {
        const items = itemsFor(submission);
        const selected = selectedFor(submission, items);
        const locked = Boolean(decisionFor(submission));
        const acceptedCount = items.filter(item => selected.includes(item.id)).length;
        const deletedCount = items.length - acceptedCount;
        return <article className="submission-card submission-card--review" key={submission.id}>
          <header className="submission-card__header"><div className="submission-card__identity"><strong>{submission.contributorName || "Anonim"}</strong><span>{formatSubmittedAt(submission.submittedAt)} · {items.length} media{items.length > 0 ? ` · ${formatBytes(items.reduce((sum, item) => sum + item.sizeBytes, 0))}` : ""}</span></div><span className="submission-status">{locked ? "Perlu diselesaikan" : "Belum diperiksa"}</span></header>
          {submission.message ? submission.message.length > 240 ? <details className="submission-wish"><summary>{submission.message.slice(0, 180)}… <span>Baca ucapan lengkap</span></summary><blockquote className="submission-card__message">{submission.message}</blockquote></details> : <blockquote className="submission-card__message">“{submission.message}”</blockquote> : null}
          {locked ? <p className="submission-resume-note">Pilihan sudah tercatat. Lanjutkan penyimpanan agar pemindahan dan penghapusan file selesai.</p> : null}
          {items.length > 0 ? <>
            <div className="submission-pick-tools"><span>{acceptedCount} dari {items.length} dicentang</span><Button variant="ghost" disabled={busy || locked} onClick={() => setChoices(current => ({ ...current, [submission.id]: acceptedCount === items.length ? [] : items.map(item => item.id) }))}>{acceptedCount === items.length ? "Kosongkan pilihan" : "Centang semua"}</Button></div>
            <div className="submission-media-grid">{items.map(item => {
              const checked = selected.includes(item.id);
              const url = previewUrlByMediaId[item.id];
              return <figure key={item.id} className={`submission-media submission-media--selectable ${checked ? "is-selected" : "is-rejected"}`}>
                <label className="submission-media__check"><input type="checkbox" checked={checked} disabled={busy || locked} onChange={event => toggle(submission, items, item.id, event.target.checked)} aria-label={`Terima ${item.originalFileName}`} /><span>{checked ? "Terima" : "Akan dihapus"}</span></label>
                <button type="button" className="submission-media__open" onClick={() => void openPreview(submission.id, item)} aria-label={`Lihat utuh ${item.originalFileName}`}>
                  {url ? item.type === "photo" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={item.originalFileName} src={url} loading="lazy" />
                  ) : <video muted playsInline preload="metadata" src={url} /> : <span className="submission-media__loading">{item.type === "photo" ? <PhotoIcon size={24} /> : <VideoIcon size={24} />}</span>}
                  <span className="submission-media__open-label">{item.type === "video" ? <VideoIcon size={14} /> : <PhotoIcon size={14} />}{item.type === "video" ? "Putar video" : "Lihat utuh"}</span>
                </button>
                <figcaption><strong title={item.originalFileName}>{item.originalFileName}</strong><span>{item.type === "photo" ? "Foto" : "Video"} · {formatBytes(item.sizeBytes)}</span></figcaption>
              </figure>;
            })}</div>
          </> : null}
          <footer className="submission-card__footer"><div className="submission-review-count"><strong>{acceptedCount} diterima · {deletedCount} dihapus</strong>{submission.message ? <small>Ucapan ikut disimpan saat menerima.</small> : null}</div><div className="submission-review-actions"><Button className="submission-action--danger" disabled={busy || locked} variant="ghost" leadingIcon={<TrashIcon size={15} />} onClick={() => requestReview(submission, "delete")}>Hapus kiriman</Button><Button disabled={busy} variant="primary" onClick={() => requestReview(submission, "approve")}>{locked ? "Lanjutkan penyimpanan" : items.length === 0 ? "Terima ucapan" : "Simpan pilihan"}</Button></div></footer>
        </article>;
      })}</div>
    </>}
    <Dialog open={Boolean(review)} onClose={() => setReview(null)} title={review?.decision.action === "delete" ? "Hapus seluruh kiriman?" : "Simpan pilihan kiriman?"} busy={busy} className="submission-confirm-dialog">
      {review ? <><p>Dari <strong>{review.submission.contributorName || "Anonim"}</strong></p><div className="submission-review-totals"><div><strong>{review.decision.acceptedMediaIds.length}</strong><span>media diterima</span></div><div><strong>{rejectedItems.length}</strong><span>media dihapus · {formatBytes(rejectedItems.reduce((sum, item) => sum + item.sizeBytes, 0))}</span></div></div>
        {rejectedItems.length > 0 ? <><p>Media tanpa centang akan dihapus permanen dari penyimpanan dan data Room.</p><details className="submission-delete-list"><summary>Lihat {rejectedItems.length} file yang akan dihapus</summary><ul>{rejectedItems.map(item => <li key={item.id}>{item.originalFileName} <span>({formatBytes(item.sizeBytes)})</span></li>)}</ul></details></> : null}
        {review.submission.message ? <p>{review.decision.action === "delete" ? "Ucapan dalam kiriman ini juga akan dihapus." : "Ucapan teks tetap disimpan."}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="submission-review-actions"><Button disabled={busy} variant="ghost" onClick={() => setReview(null)}>Kembali</Button><Button disabled={busy} variant="primary" onClick={() => void saveReview()}>{busy ? "Menyimpan & membersihkan…" : pending[review.submission.id] || review.submission.moderation ? "Lanjutkan penyimpanan" : rejectedItems.length > 0 || review.decision.action === "delete" ? "Konfirmasi & simpan" : "Terima kiriman"}</Button></div></> : null}
    </Dialog>
    <Dialog open={Boolean(preview && previewItem)} onClose={closePreview} title={previewItem?.originalFileName ?? "Preview media"} className="submission-preview-dialog">
      {previewItem && previewSubmission ? <><p className="submission-preview-meta">{previewItem.type === "photo" ? "Foto" : "Video"} · {formatBytes(previewItem.sizeBytes)} · {previewIndex + 1} dari {previewItems.length}</p><div className="submission-preview-stage">
        {previewError ? <div role="alert"><p>{previewError}</p><Button onClick={() => void openPreview(previewSubmission.id, previewItem)}>Muat ulang preview</Button></div> : previewUrl ? previewItem.type === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={previewUrl} src={previewUrl} alt={previewItem.originalFileName} onError={() => setPreviewError("Foto gagal dimuat. Coba muat ulang preview.")} />
        ) : <video key={previewUrl} src={previewUrl} controls playsInline preload="metadata" onError={() => setPreviewError("Video gagal dimuat. Coba muat ulang preview.")} /> : <p role="status">Membuka media…</p>}
      </div><div className="submission-preview-footer"><label className="submission-media__check"><input type="checkbox" checked={selectedFor(previewSubmission, previewItems).includes(previewItem.id)} disabled={busy || Boolean(decisionFor(previewSubmission))} onChange={event => toggle(previewSubmission, previewItems, previewItem.id, event.target.checked)} /><span>Terima media ini</span></label><div className="submission-review-actions"><Button variant="ghost" disabled={previewIndex <= 0} onClick={() => void openPreview(previewSubmission.id, previewItems[previewIndex - 1])}>← Sebelumnya</Button><Button variant="secondary" disabled={previewIndex >= previewItems.length - 1} onClick={() => void openPreview(previewSubmission.id, previewItems[previewIndex + 1])}>Berikutnya →</Button></div></div></> : null}
    </Dialog>
  </div>;
}
