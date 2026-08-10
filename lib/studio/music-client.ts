"use client";

import { roomMusicAnalysisInputSchema, type RoomMusicAnalysisInput } from "./contracts";

const ANALYSIS_STEP_SEC = 0.05;
const MAX_ENERGY_POINTS = 160;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], mean: number) {
  if (values.length === 0) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function normalize(values: number[]) {
  const max = Math.max(...values, 0.000001);
  return values.map((value) => clamp01(value / max));
}

function compressCurve(values: number[], maxPoints: number) {
  if (values.length <= maxPoints) return values;
  const result: number[] = [];
  const span = values.length / maxPoints;
  for (let index = 0; index < maxPoints; index += 1) {
    const start = Math.floor(index * span);
    const end = Math.max(start + 1, Math.floor((index + 1) * span));
    result.push(average(values.slice(start, end)));
  }
  return result;
}

function estimateBpm(envelope: number[], stepSec: number) {
  const centeredMean = average(envelope);
  const centered = envelope.map((value) => value - centeredMean);
  let bestBpm = 90;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let bpm = 60; bpm <= 180; bpm += 1) {
    const lag = Math.max(1, Math.round((60 / bpm) / stepSec));
    if (lag >= centered.length) continue;
    let score = 0;
    for (let index = lag; index < centered.length; index += 1) {
      score += centered[index] * centered[index - lag];
    }
    score /= Math.max(1, centered.length - lag);
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  return bestBpm;
}

function detectOnsets(envelope: number[], stepSec: number) {
  const deltas = envelope.map((value, index) => index === 0 ? 0 : Math.max(0, value - envelope[index - 1]));
  const mean = average(deltas);
  const threshold = mean + standardDeviation(deltas, mean) * 0.7;
  const minGapBins = Math.max(1, Math.round(0.16 / stepSec));
  const onsets: number[] = [];
  let lastIndex = -minGapBins;

  for (let index = 1; index < deltas.length - 1; index += 1) {
    if (deltas[index] < threshold || deltas[index] < deltas[index - 1] || deltas[index] < deltas[index + 1]) continue;
    if (index - lastIndex < minGapBins) {
      const previous = onsets.length - 1;
      const previousIndex = Math.round((onsets[previous] ?? 0) / stepSec);
      if (previous >= 0 && deltas[index] > (deltas[previousIndex] ?? 0)) {
        onsets[previous] = Number((index * stepSec).toFixed(3));
        lastIndex = index;
      }
      continue;
    }
    onsets.push(Number((index * stepSec).toFixed(3)));
    lastIndex = index;
  }

  return onsets.slice(0, 5000);
}

function beatGrid(durationSec: number, bpm: number, onsets: number[], envelope: number[], stepSec: number) {
  const period = 60 / bpm;
  const earlyOnset = onsets.find((value) => value <= Math.min(4, durationSec * 0.2));
  let phase = earlyOnset ?? 0;
  if (earlyOnset === undefined && envelope.length > 0) {
    const earlyBins = Math.max(1, Math.floor(Math.min(4, durationSec * 0.2) / stepSec));
    let maxIndex = 0;
    for (let index = 1; index < Math.min(earlyBins, envelope.length); index += 1) {
      if (envelope[index] > envelope[maxIndex]) maxIndex = index;
    }
    phase = maxIndex * stepSec;
  }

  while (phase - period >= 0) phase -= period;
  const beats: number[] = [];
  for (let cursor = phase; cursor <= durationSec + 0.001; cursor += period) {
    if (cursor >= 0) beats.push(Number(cursor.toFixed(3)));
    if (beats.length >= 5000) break;
  }
  return beats;
}

function sectionRanges(durationSec: number, normalizedEnvelope: number[]) {
  const introEnd = Math.min(durationSec, Math.max(2, durationSec * 0.18));
  const outroStart = Math.max(introEnd, durationSec * 0.82);
  const curve = normalizedEnvelope.length > 0 ? normalizedEnvelope : [0];
  let peakIndex = 0;
  for (let index = 1; index < curve.length; index += 1) {
    if (curve[index] > curve[peakIndex]) peakIndex = index;
  }
  const peakCenter = (peakIndex / Math.max(1, curve.length - 1)) * durationSec;
  const peakSpan = Math.max(2, Math.min(durationSec * 0.26, 18));
  const peakStart = Math.max(introEnd, Math.min(outroStart, peakCenter - peakSpan / 2));
  const peakEnd = Math.max(peakStart, Math.min(outroStart, peakCenter + peakSpan / 2));

  return {
    intro: [0, Number(introEnd.toFixed(3))] as [number, number],
    build: [Number(introEnd.toFixed(3)), Number(peakStart.toFixed(3))] as [number, number],
    peak: [Number(peakStart.toFixed(3)), Number(Math.max(peakEnd, peakStart).toFixed(3))] as [number, number],
    outro: [Number(outroStart.toFixed(3)), Number(durationSec.toFixed(3))] as [number, number],
  };
}

function inferMood(bpm: number, energy: number) {
  const mood = new Set<string>();
  if (bpm >= 118 || energy >= 0.72) mood.add("energetic");
  if (bpm >= 96) mood.add("uplifting");
  if (bpm < 90) mood.add("reflective");
  if (energy < 0.45) mood.add("calm");
  if (energy >= 0.45 && energy < 0.75) mood.add("warm");
  if (energy >= 0.68) mood.add("celebratory");
  if (mood.size === 0) mood.add("balanced");
  return Array.from(mood).slice(0, 6);
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function analyzeRoomMusicFile(file: File): Promise<RoomMusicAnalysisInput> {
  const buffer = await file.arrayBuffer();
  const hashPromise = sha256Hex(buffer.slice(0));
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) throw new Error("Browser ini belum mendukung Web Audio untuk analisis lagu.");

  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(buffer.slice(0));
    const durationSec = decoded.duration;
    if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 20 * 60) {
      throw new Error("Durasi lagu tidak valid atau melebihi 20 menit.");
    }

    const sampleRate = decoded.sampleRate;
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const stepSamples = Math.max(1, Math.round(sampleRate * ANALYSIS_STEP_SEC));
    const envelope: number[] = [];

    for (let start = 0; start < decoded.length; start += stepSamples) {
      const end = Math.min(decoded.length, start + stepSamples);
      const stride = Math.max(1, Math.floor((end - start) / 256));
      let sumSquares = 0;
      let count = 0;
      for (let cursor = start; cursor < end; cursor += stride) {
        let mono = 0;
        for (const channel of channels) mono += channel[cursor] ?? 0;
        mono /= Math.max(1, channels.length);
        sumSquares += mono * mono;
        count += 1;
      }
      envelope.push(Math.sqrt(sumSquares / Math.max(1, count)));
    }

    const normalizedEnvelope = normalize(envelope);
    const bpm = estimateBpm(normalizedEnvelope, ANALYSIS_STEP_SEC);
    const onsets = detectOnsets(normalizedEnvelope, ANALYSIS_STEP_SEC);
    const beats = beatGrid(durationSec, bpm, onsets, normalizedEnvelope, ANALYSIS_STEP_SEC);
    const energyCurve = compressCurve(normalizedEnvelope, MAX_ENERGY_POINTS).map((value) => Number(clamp01(value).toFixed(4)));
    const energy = average(energyCurve);

    return roomMusicAnalysisInputSchema.parse({
      hash: await hashPromise,
      durationSec: Number(durationSec.toFixed(3)),
      bpm,
      beats,
      onsets,
      energyCurve,
      mood: inferMood(bpm, energy),
      sections: sectionRanges(durationSec, normalizedEnvelope),
    });
  } finally {
    await context.close().catch(() => undefined);
  }
}
