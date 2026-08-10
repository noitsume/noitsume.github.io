"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/auth/client";
import { CheckIcon, CopyIcon, ExternalLinkIcon, Surface } from "@/components/ui";

export function ReceiverFinishCard({
  receiverId,
  receiverUrl,
  revision,
  roomId,
}: {
  receiverId: string;
  receiverUrl: string;
  revision: number;
  roomId: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyLink() {
    await navigator.clipboard.writeText(receiverUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
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
      <p className="ui-eyebrow">SELESAI · REVISION {revision}</p>
      <h1>Receiver sudah siap dibagikan.</h1>
      <p>Token link tetap stabil saat Room di-bake ulang. Snapshot revision berikutnya akan mengganti isi Receiver tanpa mengganti URL.</p>
      <div className="receiver-finish-card__token"><small>Receiver token</small><strong>{receiverId}</strong></div>
      <div className="receiver-finish-card__url"><span>{receiverUrl}</span><button aria-label="Salin link Receiver" onClick={copyLink} type="button">{copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}</button></div>
      <div className="receiver-finish-card__actions">
        <a className="ui-button ui-button--primary" href={receiverUrl} rel="noreferrer" target="_blank"><ExternalLinkIcon size={15} /> Preview Receiver</a>
        <button className="ui-button ui-button--ghost" disabled={reopening} onClick={reopenStudio} type="button">{reopening ? "Membuka..." : "Atur lagi"}</button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </Surface>
  );
}
