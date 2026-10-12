"use client";

import { useRef, useState } from "react";
import { getCsrfToken } from "@/lib/auth/client";
import type { BackgroundMusicSelection, RoomMusic } from "@/lib/creative";
import { analyzeRoomMusicFile } from "@/lib/studio/music-client";

export async function studioRequest<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(url, body === undefined ? { credentials: "same-origin", cache: "no-store" } : {
    method, credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": await getCsrfToken() }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.ok) throw new Error(payload?.error?.message ?? "Belum berhasil. Coba lagi sebentar lagi.");
  return payload.data as T;
}

export function MusicLibrary({ roomId, tracks, selected, onTracks, onSelect, onBusy }: {
  roomId: string; tracks: RoomMusic[]; selected: BackgroundMusicSelection | null;
  onTracks: (tracks: RoomMusic[]) => void; onSelect: (selection: BackgroundMusicSelection) => void; onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [listen, setListen] = useState<{ id: string; url: string } | null>(null);
  const base = `/api/rooms/${encodeURIComponent(roomId)}/music`;
  function lock(value: string | null) { setBusy(value); onBusy(Boolean(value)); }
  async function upload() {
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith(".mp3") || file.size > 30 * 1024 * 1024 || !file.size) { setError("Pilih MP3 berukuran lebih dari 0 dan maksimal 30 MB."); return; }
    lock("upload"); setError(""); setListen(null); setStatus("Mengunggah MP3…");
    try {
      const info = { name: file.name.replace(/\.mp3$/i, "").trim().slice(0, 100) || "Musik pilihanmu", fileName: file.name, contentType: "audio/mpeg", sizeBytes: file.size };
      const prepared = await studioRequest<{ musicId: string; objectKey: string; uploadUrl: string }>(`${base}/upload-url`, info);
      const response = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "content-type": "audio/mpeg" }, body: file });
      if (!response.ok) throw new Error("MP3 belum terunggah ke penyimpanan. Coba lagi.");
      const { music } = await studioRequest<{ music: RoomMusic }>(`${base}/commit`, { ...info, musicId: prepared.musicId, objectKey: prepared.objectKey });
      onTracks([music, ...tracks.filter(track => track.id !== music.id)]);
      setFile(null); if (input.current) input.current.value = "";
      setStatus("MP3 tersimpan. Tekan Siapkan beatmap untuk Aura, lalu gunakan lagunya.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Upload belum berhasil."); setStatus(""); }
    finally { lock(null); }
  }
  async function prepare(track: RoomMusic) {
    lock(track.id); setError(""); setListen(null); setStatus(`Menyiapkan beatmap ${track.name}… Tetap di halaman ini.`);
    try {
      const { url } = await studioRequest<{ url: string }>(`${base}/${encodeURIComponent(track.id)}/download-url`);
      const response = await fetch(url);
      if (!response.ok) throw new Error("File musik belum bisa dibaca. Coba lagi.");
      const analysis = await analyzeRoomMusicFile(new File([await response.blob()], track.originalFileName, { type: "audio/mpeg" }), progress => setStatus(`Membaca ritme ${track.name}… ${Math.round(progress * 100)}%`));
      const { music } = await studioRequest<{ music: RoomMusic }>(`${base}/${encodeURIComponent(track.id)}/analyze`, analysis);
      onTracks(tracks.map(item => item.id === music.id ? music : item));
      setStatus("Beatmap rinci siap: hentakan, energi bass, detail frekuensi, dan spektrum. Lagu ini bisa dipakai sebagai soundtrack atau musik section.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Beatmap belum siap. File tetap tersimpan, silakan coba lagi."); setStatus(""); }
    finally { lock(null); }
  }
  async function preview(track: RoomMusic) {
    lock("listen"); setError("");
    try { const { url } = await studioRequest<{ url: string }>(`${base}/${encodeURIComponent(track.id)}/download-url`); setListen({ id: track.id, url }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Musik belum bisa diputar."); }
    finally { lock(null); }
  }
  return <div className="story-music-library">
    <fieldset disabled={Boolean(busy)} className="story-upload"><legend>Unggah musikmu</legend><p>MP3 · maksimal 30 MB dan 20 menit. Beatmap disiapkan dari lagu ini untuk menggerakkan Aura.</p><input ref={input} aria-label="Pilih file musik MP3" type="file" accept=".mp3,audio/mpeg" onChange={event => setFile(event.target.files?.[0] ?? null)} /><button type="button" className="ui-button ui-button--primary" disabled={!file || Boolean(busy)} onClick={() => void upload()}>{busy === "upload" ? "Mengunggah…" : "Upload MP3"}</button></fieldset>
    {status ? <p role="status" className="story-notice">{status}</p> : null}{error ? <p role="alert" className="story-error">{error}</p> : null}
    <div className="story-track-list">{tracks.map(track => <article key={track.id} className={selected?.musicId === track.id ? "is-selected" : ""}><div><strong>{track.name}</strong><small>{(track.sizeBytes / 1024 / 1024).toFixed(1)} MB · {track.analysis.status === "ready" ? `${Math.round(track.analysis.bpm ?? 0)} BPM perkiraan · Beatmap siap` : "Beatmap belum siap"}</small></div><div className="story-track-actions">{track.analysis.status === "ready" && track.analysis.version !== "music-v2" ? <button type="button" disabled={Boolean(busy)} onClick={() => void prepare(track)}>Tingkatkan beatmap</button> : null}<button type="button" disabled={Boolean(busy)} onClick={() => void preview(track)}>Dengarkan</button>{track.analysis.status === "ready" ? <button type="button" disabled={Boolean(busy)} className="ui-button ui-button--primary" onClick={() => { setListen(null); onSelect({ source: "room-upload", musicId: track.id }); }}>{selected?.musicId === track.id ? "✓ Dipilih" : "Gunakan"}</button> : <button type="button" disabled={Boolean(busy)} onClick={() => void prepare(track)}>{busy === track.id ? "Menyiapkan…" : "Siapkan beatmap"}</button>}</div>{listen?.id === track.id ? <audio controls autoPlay src={listen.url} onError={() => setError("Musik belum dapat diputar. Tekan Dengarkan untuk memuat ulang.")} /> : null}</article>)}</div>
  </div>;
}
