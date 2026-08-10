"use client";

import type { AnalysisMode, MediaAnalysisInput, TechnicalSignals } from "./contracts";

type ProxyImage = MediaAnalysisInput["visualProxies"][number];

type PixelStats = {
  brightness: number;
  grayscale: Uint8Array;
};

const QUICK_MAX_EDGE = 640;
const DEEP_MAX_EDGE = 860;
const QUICK_VIDEO_FRAMES = 4;
const DEEP_VIDEO_FRAMES = 8;
const QUICK_AUDIO_SECONDS = 12;
const DEEP_AUDIO_SECONDS = 24;
const AUDIO_DECODE_FILE_BUDGET = 24 * 1024 * 1024;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function orientation(width: number, height: number): TechnicalSignals["orientation"] {
  if (!width || !height) return "unknown";
  const ratio = width / height;
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

function dataUrlBase64(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function canvasToJpegProxy(canvas: HTMLCanvasElement, quality: number, timestampSec: number | null): ProxyImage {
  return {
    mimeType: "image/jpeg",
    dataBase64: dataUrlBase64(canvas.toDataURL("image/jpeg", quality)),
    timestampSec,
  };
}

function fittedSize(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function pixelStats(canvas: HTMLCanvasElement): PixelStats {
  const sampleCanvas = document.createElement("canvas");
  const sampleWidth = 48;
  const sampleHeight = Math.max(1, Math.round((canvas.height / canvas.width) * sampleWidth));
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { brightness: 0.5, grayscale: new Uint8Array() };
  context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const grayscale = new Uint8Array(sampleWidth * sampleHeight);
  let sum = 0;
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const gray = Math.round(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    grayscale[pixel] = gray;
    sum += gray;
  }
  return { brightness: clamp01(sum / Math.max(1, grayscale.length) / 255), grayscale };
}

function motionBetween(previous: Uint8Array, current: Uint8Array) {
  const length = Math.min(previous.length, current.length);
  if (length === 0) return 0;
  let delta = 0;
  for (let index = 0; index < length; index += 1) delta += Math.abs(previous[index] - current[index]);
  return clamp01(delta / length / 96);
}

function sampleTimestamps(durationSec: number, count: number) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return [0];
  if (durationSec < 1.2) return [Math.max(0, durationSec / 2)];
  const points = count === 4
    ? [0.1, 0.36, 0.64, 0.9]
    : [0.05, 0.18, 0.31, 0.44, 0.57, 0.7, 0.83, 0.95];
  return points.map((point) => Math.min(Math.max(0, durationSec * point), Math.max(0, durationSec - 0.05)));
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Foto tidak dapat dibaca untuk analysis proxy."));
      image.src = url;
    });
    return image;
  } finally {
    // The image has already decoded into memory at this point.
    URL.revokeObjectURL(url);
  }
}

async function preprocessPhoto(file: File, mode: AnalysisMode, startedAt: number): Promise<MediaAnalysisInput> {
  const image = await loadImage(file);
  const maxEdge = mode === "deep" ? DEEP_MAX_EDGE : QUICK_MAX_EDGE;
  const size = fittedSize(image.naturalWidth, image.naturalHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas browser tidak tersedia.");
  context.drawImage(image, 0, 0, size.width, size.height);
  const stats = pixelStats(canvas);
  const proxy = canvasToJpegProxy(canvas, mode === "deep" ? 0.72 : 0.62, null);
  const visualProxyBytes = Math.floor(proxy.dataBase64.length * 0.75);

  return {
    mode,
    visualProxies: [proxy],
    audioProxy: null,
    technicalSignals: {
      width: image.naturalWidth || null,
      height: image.naturalHeight || null,
      durationSec: null,
      orientation: orientation(image.naturalWidth, image.naturalHeight),
      aspectRatio: image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : null,
      brightness: stats.brightness,
      motion: 0,
      audioPresence: "absent",
      audioEnergy: null,
      sampleTimestampsSec: [],
      fileSizeBytes: file.size,
      preprocess: {
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        visualProxyBytes,
        audioProxyBytes: 0,
        audioProxyMethod: "none",
        audioProxyStatus: "not_requested",
      },
    },
  };
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadedmetadata" | "loadeddata" | "seeked", timeoutMs = 8_000) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Video timeout saat menunggu ${eventName}.`));
    }, timeoutMs);
    const onSuccess = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Video tidak dapat dibaca untuk analysis proxy.")); };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, onSuccess);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onSuccess, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function seekVideo(video: HTMLVideoElement, timestampSec: number) {
  if (Math.abs(video.currentTime - timestampSec) < 0.02) return;
  const done = waitForVideoEvent(video, "seeked", 6_000);
  video.currentTime = timestampSec;
  await done;
}

function encodeWavMono(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunk)));
  }
  return btoa(binary);
}

async function tryExtractAudioProxy(file: File, maxDurationSec: number) {
  if (file.size > AUDIO_DECODE_FILE_BUDGET) {
    return { proxy: null, energy: null, status: "skipped_budget" as const };
  }
  if (typeof AudioContext === "undefined") {
    return { proxy: null, energy: null, status: "unsupported" as const };
  }

  const context = new AudioContext({ sampleRate: 16_000 });
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    if (!decoded.numberOfChannels || !decoded.length) {
      return { proxy: null, energy: null, status: "unsupported" as const };
    }

    const source = decoded.getChannelData(0);
    const targetRate = 16_000;
    const ratio = decoded.sampleRate / targetRate;
    const maxSamples = Math.floor(maxDurationSec * targetRate);
    const outputLength = Math.min(maxSamples, Math.floor(source.length / ratio));
    const downsampled = new Float32Array(outputLength);
    let squareSum = 0;
    for (let index = 0; index < outputLength; index += 1) {
      const sourceIndex = Math.min(source.length - 1, Math.floor(index * ratio));
      const value = source[sourceIndex] ?? 0;
      downsampled[index] = value;
      squareSum += value * value;
    }
    const rms = Math.sqrt(squareSum / Math.max(1, outputLength));
    const wav = encodeWavMono(downsampled, targetRate);
    return {
      proxy: {
        mimeType: "audio/wav" as const,
        dataBase64: bytesToBase64(wav),
        durationSec: outputLength / targetRate,
      },
      energy: clamp01(rms * 3.5),
      status: "ready" as const,
    };
  } catch {
    return { proxy: null, energy: null, status: "failed" as const };
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function preprocessVideo(file: File, mode: AnalysisMode, startedAt: number): Promise<MediaAnalysisInput> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  video.load();

  try {
    await waitForVideoEvent(video, "loadedmetadata", 10_000);
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, "loadeddata", 10_000);
    }
    const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
    const maxEdge = mode === "deep" ? DEEP_MAX_EDGE : QUICK_MAX_EDGE;
    const size = fittedSize(video.videoWidth, video.videoHeight, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas browser tidak tersedia.");

    const timestamps = sampleTimestamps(durationSec, mode === "deep" ? DEEP_VIDEO_FRAMES : QUICK_VIDEO_FRAMES);
    const proxies: ProxyImage[] = [];
    const brightnessValues: number[] = [];
    const motionValues: number[] = [];
    let previousGray: Uint8Array | null = null;

    for (const timestampSec of timestamps) {
      await seekVideo(video, timestampSec);
      context.drawImage(video, 0, 0, size.width, size.height);
      const stats = pixelStats(canvas);
      brightnessValues.push(stats.brightness);
      if (previousGray) motionValues.push(motionBetween(previousGray, stats.grayscale));
      previousGray = stats.grayscale;
      proxies.push(canvasToJpegProxy(canvas, mode === "deep" ? 0.68 : 0.55, timestampSec));
    }

    const audioAttempt = await tryExtractAudioProxy(
      file,
      mode === "deep" ? DEEP_AUDIO_SECONDS : QUICK_AUDIO_SECONDS,
    );
    const visualProxyBytes = proxies.reduce((sum, item) => sum + Math.floor(item.dataBase64.length * 0.75), 0);
    const audioProxyBytes = audioAttempt.proxy ? Math.floor(audioAttempt.proxy.dataBase64.length * 0.75) : 0;
    const average = (values: number[]) => values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : null;

    return {
      mode,
      visualProxies: proxies,
      audioProxy: audioAttempt.proxy,
      technicalSignals: {
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        durationSec,
        orientation: orientation(video.videoWidth, video.videoHeight),
        aspectRatio: video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : null,
        brightness: average(brightnessValues),
        motion: average(motionValues),
        audioPresence: audioAttempt.proxy ? "present" : "unknown",
        audioEnergy: audioAttempt.energy,
        sampleTimestampsSec: timestamps,
        fileSizeBytes: file.size,
        preprocess: {
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          visualProxyBytes,
          audioProxyBytes,
          audioProxyMethod: audioAttempt.proxy ? "web-audio" : "none",
          audioProxyStatus: audioAttempt.status,
        },
      },
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export async function preprocessMediaFile(file: File, mode: AnalysisMode = "quick_look"): Promise<MediaAnalysisInput> {
  const startedAt = performance.now();
  if (file.type.startsWith("image/")) return preprocessPhoto(file, mode, startedAt);
  if (file.type.startsWith("video/")) return preprocessVideo(file, mode, startedAt);
  throw new Error("Format media belum didukung untuk Media Intelligence.");
}

function analysisBase64Chars(input: MediaAnalysisInput) {
  return input.visualProxies.reduce((sum, item) => sum + item.dataBase64.length, 0)
    + (input.audioProxy?.dataBase64.length ?? 0);
}

export function fitAnalysisBatchBudget(
  inputs: Array<MediaAnalysisInput | undefined>,
  maxBase64Chars = 3_600_000,
) {
  const next = inputs.map((input) => input ? structuredClone(input) : undefined);
  const totalChars = () => next.reduce((sum, input) => sum + (input ? analysisBase64Chars(input) : 0), 0);

  if (totalChars() > maxBase64Chars) {
    for (const input of next) {
      if (!input?.audioProxy) continue;
      input.audioProxy = null;
      input.technicalSignals.preprocess.audioProxyBytes = 0;
      input.technicalSignals.preprocess.audioProxyMethod = "none";
      input.technicalSignals.preprocess.audioProxyStatus = "skipped_budget";
    }
  }

  while (totalChars() > maxBase64Chars) {
    let trimmed = false;
    for (const input of next) {
      if (!input || input.visualProxies.length <= 1) continue;
      const removeIndex = Math.max(1, input.visualProxies.length - 2);
      input.visualProxies.splice(removeIndex, 1);
      input.technicalSignals.sampleTimestampsSec = input.visualProxies
        .map((proxy) => proxy.timestampSec)
        .filter((value): value is number => value !== null);
      input.technicalSignals.preprocess.visualProxyBytes = input.visualProxies
        .reduce((sum, item) => sum + Math.floor(item.dataBase64.length * 0.75), 0);
      trimmed = true;
      if (totalChars() <= maxBase64Chars) break;
    }
    if (!trimmed) break;
  }

  return next;
}

export async function preprocessMediaFiles(files: File[], mode: AnalysisMode = "quick_look") {
  const results: MediaAnalysisInput[] = [];
  for (const file of files) results.push(await preprocessMediaFile(file, mode));
  return results;
}
