"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/auth/client";
import { Surface } from "@/components/ui";

export function BakeProgressShell({ roomId, recipientName, mediaCount, musicName, directionName }: { roomId: string; recipientName: string; mediaCount: number; musicName: string; directionName: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function publish() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const csrf = await getCsrfToken();
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/bake`, { method: "POST", headers: { "x-csrf-token": csrf } });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Kejutan belum berhasil diterbitkan.");
      router.replace(`/rooms/${encodeURIComponent(roomId)}/finish`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Penerbitan belum berhasil. Coba lagi.");
      inFlight.current = false; setBusy(false);
    }
  }
  return <Surface className="bake-progress-shell" tone="elevated">
    <p className="ui-eyebrow">SATU LANGKAH MENUJU SENYUMNYA</p><h1>{busy ? "Sedang menyiapkan kejutanmu…" : `Sudah siap untuk ${recipientName}?`}</h1>
    <p>{busy ? "Kami memeriksa media dan menyiapkan tautan. Tetap di halaman ini sampai proses selesai." : "Periksa pilihanmu sekali lagi. Setelah terbit, tautan kejutan siap kamu bagikan."}</p>
    <dl className="publish-summary"><div><dt>Momen dalam cerita</dt><dd>{mediaCount} foto & video</dd></div><div><dt>Musik</dt><dd>{musicName}</dd></div><div><dt>Susunan cerita</dt><dd>{directionName}</dd></div></dl>
    {busy ? <div className="journey-loading" role="status" aria-label="Memeriksa dan menerbitkan" /> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="finish-secondary">{busy ? null : <Link className="ui-button ui-button--ghost" href={`/rooms/${roomId}/studio`}>← Kembali ke Studio</Link>}<button className="ui-button ui-button--primary" disabled={busy} onClick={publish}>{busy ? "Menyiapkan…" : error ? "Coba terbitkan lagi" : "Terbitkan kejutan →"}</button></div>
    <p className="publish-note">Siapa pun dengan tautan kejutan dapat melihat cerita ini. Kamu tetap bisa mengubah cerita setelah terbit.</p>
  </Surface>;
}
