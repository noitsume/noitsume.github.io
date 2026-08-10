"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon, Surface } from "@/components/ui";

export function ReceiverFinishCard({ receiverId, receiverUrl }: { receiverId: string; receiverUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(receiverUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <Surface className="receiver-finish-card" tone="elevated">
      <span className="receiver-finish-card__check"><CheckIcon size={28} /></span>
      <p className="ui-eyebrow">SELESAI</p>
      <h1>Receiver sudah siap dibagikan.</h1>
      <p>Token link tetap stabil saat Room di-bake ulang. Receiver Engine akan membaca snapshot publish, bukan draft Studio.</p>
      <div className="receiver-finish-card__token"><small>Receiver token</small><strong>{receiverId}</strong></div>
      <div className="receiver-finish-card__url"><span>{receiverUrl}</span><button aria-label="Salin link Receiver" onClick={copyLink} type="button">{copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}</button></div>
      <a className="ui-button ui-button--primary" href={receiverUrl} rel="noreferrer" target="_blank"><ExternalLinkIcon size={15} /> Preview Receiver</a>
    </Surface>
  );
}
