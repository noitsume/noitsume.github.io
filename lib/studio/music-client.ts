"use client";

import { roomMusicAnalysisInputSchema, type RoomMusicAnalysisInput } from "./contracts";

/** Runs once in Studio for section MP3s and video audio, never in Receiver. */
export async function analyzeRoomMusicFile(file: File, onProgress?: (progress: number) => void): Promise<RoomMusicAnalysisInput> {
  const buffer = await file.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))).map(v => v.toString(16).padStart(2, "0")).join("");
  const context = new OfflineAudioContext(2, 1, 22050);
  let decoded: AudioBuffer;
  try { decoded = await context.decodeAudioData(buffer); }
  catch { throw new Error("Audio tidak dapat dibaca. Gunakan MP3, atau video dengan audio AAC yang didukung browser."); }
  if (!Number.isFinite(decoded.duration) || decoded.duration <= 0 || decoded.duration > 1200) throw new Error("Durasi audio harus lebih dari 0 dan maksimal 20 menit.");
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i).slice());
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../audio/analysis.worker.ts", import.meta.url));
    const timer = window.setTimeout(() => { worker.terminate(); reject(new Error("Analisis terlalu lama. Coba lagi atau gunakan potongan yang lebih pendek.")); }, 180000);
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    worker.onerror = () => { finish(); reject(new Error("Pemroses audio berhenti. Muat ulang halaman lalu coba lagi.")); };
    worker.onmessage = ({ data }) => {
      if (typeof data.progress === "number") onProgress?.(data.progress);
      if (data.error) { finish(); reject(new Error(data.error)); }
      if (data.result) { finish(); const parsed = roomMusicAnalysisInputSchema.safeParse(data.result); if (parsed.success) resolve(parsed.data); else reject(new Error("Hasil beatmap tidak valid. Coba analisis ulang.")); }
    };
    worker.postMessage({ channels, sampleRate: decoded.sampleRate, hash }, channels.map(c => c.buffer));
  });
}

