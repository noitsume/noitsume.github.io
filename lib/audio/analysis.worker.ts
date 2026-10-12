import { extractAudioFeatures } from "./extract";
self.onmessage = (event: MessageEvent<{ channels: Float32Array[]; sampleRate: number; hash: string }>) => {
  try {
    const { channels, sampleRate, hash } = event.data;
    self.postMessage({ result: extractAudioFeatures(channels, sampleRate, hash, progress => self.postMessage({ progress })) });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Analisis audio belum berhasil." }); }
};
