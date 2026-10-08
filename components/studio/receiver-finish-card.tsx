"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/auth/client";
import { CheckIcon, CopyIcon, ExternalLinkIcon, Surface } from "@/components/ui";

export function ReceiverFinishCard({
  receiverUrl,
  revision,
  roomId,
}: {
  receiverUrl: string;
  revision: number;
  roomId: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyLink() {
    try { await navigator.clipboard.writeText(receiverUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setError("Salin tautan dari kolom di bawah jika browser tidak mengizinkan salin otomatis."); }
  }

  async function reopenStudio() {
    if (reopening) return;
    setReopening(true);
    setError(null);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/studio/start`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Studio belum dapat dibuka kembali.");
      router.push(`/rooms/${encodeURIComponent(roomId)}/studio`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Studio belum dapat dibuka kembali.");
    } finally {
      setReopening(false);
    }
  }

  return (
    <Surface className="receiver-finish-card" tone="elevated">
      <span className="receiver-finish-card__check"><CheckIcon size={28} /></span>
      <p className="ui-eyebrow">SIAP DIBAGIKAN · VERSI {revision}</p>
      <h1>Dibuat dengan hati. Siap jadi kejutan.</h1>
      <p>Buka ceritanya terlebih dahulu, lalu kirim tautan ini kepada penerima. Ceritanya bisa kamu perbarui dengan tautan yang sama.</p>
      <div className="receiver-finish-card__url"><input aria-label="Tautan kejutan" readOnly value={receiverUrl} onFocus={event => event.currentTarget.select()} /><button aria-label="Salin link Receiver" onClick={copyLink} type="button">{copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}</button></div>
      <div className="receiver-finish-card__actions">
        <a className="ui-button ui-button--primary" href={receiverUrl} rel="noreferrer" target="_blank"><ExternalLinkIcon size={15} /> Lihat kejutan</a>
        <button className="ui-button ui-button--ghost" disabled={reopening} onClick={reopenStudio} type="button">{reopening ? "Membuka..." : "Ubah cerita"}</button>
      </div>
      <button className="ui-button ui-button--secondary" onClick={async () => { if (navigator.share) { try { await navigator.share({ title: "Ada kejutan untukmu", url: receiverUrl }); } catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError")) void copyLink(); } } else void copyLink(); }}>{copied ? "Tautan tersalin ✓" : "Bagikan tautan"}</button>
      <div className="finish-secondary"><Link className="journey-back" href="/dashboard">← Kenangan saya</Link><Link className="journey-back" href={"/rooms/" + roomId}>Lihat semua kiriman →</Link></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </Surface>
  );
}
