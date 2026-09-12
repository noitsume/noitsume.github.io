"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CheckIcon, CopyIcon, ExternalLinkIcon, GridIcon, LockIcon } from "@/components/ui";
import { getCsrfToken } from "@/lib/auth/client";
import { QrCode } from "./qr-code";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function CollectorSharePanel({
  roomId,
  collectorId,
  collectorUrl,
  isOpen,
  contributorNames = [],
  inventoryCount,
  onOpenInventory,
  onCollectionClosed,
}: {
  roomId: string;
  collectorId: string;
  collectorUrl: string;
  isOpen: boolean;
  contributorNames?: string[];
  inventoryCount: number;
  onOpenInventory: () => void;
  onCollectionClosed?: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uniqueContributors = Array.from(new Set(contributorNames)).slice(0, 4);
  const remainingContributors = Math.max(0, new Set(contributorNames).size - uniqueContributors.length);

  async function copyLink() {
    setError(null);
    try {
      await navigator.clipboard.writeText(collectorUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Browser tidak mengizinkan copy otomatis. Salin URL Collector dari kolom di atas.");
    }
  }

  async function closeCollection() {
    if (!window.confirm("Tutup pengumpulan sekarang? Contributor tidak dapat mengirim submission baru setelah ini.")) return;
    setClosing(true);
    setError(null);
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/rooms/${roomId}/close`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Pengumpulan gagal ditutup.");
      onCollectionClosed?.();
      router.refresh();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Pengumpulan gagal ditutup.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="collector-share-panel">
      <div className="collector-share-panel__link">
        <span className="collector-share-panel__url" title={collectorUrl}>{collectorUrl}</span>
        <button aria-label="Salin link Collector" className="collector-share-panel__copy" onClick={copyLink} type="button">
          {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
        </button>
      </div>

      <div className="collector-share-panel__qr-row">
        <div className="collector-share-panel__qr">
          <QrCode value={collectorUrl} size={112} />
        </div>
        <div className="collector-share-panel__qr-copy">
          <strong>Pindai untuk berkontribusi</strong>
          <span>QR membuka Collector publik tanpa login.</span>
          {uniqueContributors.length > 0 ? (
            <div className="collector-share-panel__contributors" aria-label="Contributor terbaru">
              <div className="collector-share-panel__avatars">
                {uniqueContributors.map((name) => <span key={name} title={name}>{initials(name)}</span>)}
              </div>
              <small>{remainingContributors > 0 ? `+${remainingContributors} contributor lain` : `${uniqueContributors.length} contributor`}</small>
            </div>
          ) : (
            <small className="collector-share-panel__waiting">Belum ada contributor bernama.</small>
          )}
        </div>
      </div>

      <div className="collector-share-panel__actions">
        <Button variant="secondary" onClick={copyLink}>{copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />} {copied ? "Tersalin" : "Copy Link"}</Button>
        <a className="ui-button ui-button--ghost" href={`/c/${collectorId}`} rel="noreferrer" target="_blank"><ExternalLinkIcon size={16} /> Buka</a>
      </div>

      <button className="collector-share-panel__inventory" onClick={onOpenInventory} type="button">
        <span className="collector-share-panel__inventory-icon"><GridIcon size={16} /></span>
        <span><strong>Inventori Media</strong><small>{inventoryCount} media approved / upload owner</small></span>
        <span className="collector-share-panel__inventory-count">{inventoryCount}</span>
      </button>

      {isOpen ? (
        <button className="collector-share-panel__close" disabled={closing} onClick={closeCollection} type="button">
          <LockIcon size={14} /> {closing ? "Menutup pengumpulan..." : "Tutup pengumpulan"}
        </button>
      ) : (
        <div className="collector-share-panel__after-close">
          <div className="collector-share-panel__closed"><LockIcon size={14} /> Collector tidak menerima kiriman baru.</div>
          <Button variant="primary" onClick={onOpenInventory}>
            <GridIcon size={16} /> Buka Inventori Media
          </Button>
          <small>Periksa media approved, retry Quick Look yang fallback, atau upload media owner sebelum masuk Settings Studio.</small>
        </div>
      )}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
  );
}
