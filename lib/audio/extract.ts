import type { AudioFeatures } from "./features";
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const round = (v: number) => Number(v.toFixed(4));
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
function percentile(values: ArrayLike<number>, p: number) { const s = Array.from(values).sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))] || 0; }

// Radix-2 transform, reused buffers. Combine channel power AFTER FFT to preserve stereo phase.
export function fftPower(input: Float64Array, real: Float64Array, imag: Float64Array) {
  const n = input.length; real.set(input); imag.fill(0);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { const t = real[i]; real[i] = real[j]; real[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len, wr = Math.cos(angle), wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let ar = 1, ai = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2, br = real[b] * ar - imag[b] * ai, bi = real[b] * ai + imag[b] * ar;
        real[b] = real[a] - br; imag[b] = imag[a] - bi; real[a] += br; imag[a] += bi;
        const next = ar * wr - ai * wi; ai = ar * wi + ai * wr; ar = next;
      }
    }
  }
}
/** Search actual lags, never an integer BPM alias of a rounded lag. */
export function estimatePulse(novelty: readonly number[], hop: number) {
  let bestLag = Math.round(.6 / hop), bestScore = 0;
  const average = novelty.reduce((a, b) => a + b, 0) / Math.max(1, novelty.length);
  for (let lag = Math.ceil(60 / 200 / hop); lag <= Math.floor(60 / 55 / hop) && lag < novelty.length; lag++) {
    let cross = 0, aa = 0, bb = 0;
    for (let i = lag; i < novelty.length; i++) { const a = novelty[i] - average, b = novelty[i - lag] - average; cross += a * b; aa += a * a; bb += b * b; }
    const score = cross / Math.max(1e-12, Math.sqrt(aa * bb));
    if (score > bestScore + .015) { bestScore = score; bestLag = lag; }
  }
  return { bpm: 60 / (bestLag * hop), period: bestLag * hop, quality: clamp(bestScore) };
}
export function extractAudioFeatures(channels: Float32Array[], sampleRate: number, hash: string, progress?: (ratio: number) => void) {
  if (!channels.length || !channels[0].length || channels.some(c => c.length !== channels[0].length)) throw new Error("Audio kosong atau kanal tidak sesuai.");
  const duration = channels[0].length / sampleRate;
  if (duration > 1200) throw new Error("Durasi maksimal 20 menit.");
  const n = 1024, hop = Math.round(sampleRate * .01), hopSec = hop / sampleRate, count = Math.ceil(channels[0].length / hop), bins = n / 2;
  const input = new Float64Array(n), real = new Float64Array(n), imag = new Float64Array(n), power = new Float64Array(bins), previous = new Float64Array(bins);
  const window = Float64Array.from({ length: n }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (n - 1)));
  const bands = Array.from({ length: bins }, (_, k) => Math.min(15, Math.max(0, Math.floor(Math.log2(Math.max(40, k * sampleRate / n) / 40) / Math.log2(8000 / 40) * 16))));
  const rawEnergy: number[] = [], low: number[] = [], mid: number[] = [], high: number[] = [], novelty: number[] = [], rawSpectrum: number[][] = [];
  for (let frame = 0; frame < count; frame++) {
    power.fill(0); let rms = 0; const start = frame * hop - n / 2;
    for (const channel of channels) {
      for (let k = 0; k < n; k++) { const s = channel[start + k] ?? 0; input[k] = s * window[k]; rms += s * s; }
      fftPower(input, real, imag);
      for (let k = 1; k < bins; k++) power[k] += (real[k] ** 2 + imag[k] ** 2) / (channels.length * n * n);
    }
    const spectrum = Array(16).fill(0); let l = 0, m = 0, h = 0, flux = 0;
    for (let k = 1; k < bins; k++) {
      const hz = k * sampleRate / n; if (hz < 20 || hz > 8000) continue;
      const p = power[k]; spectrum[bands[k]] += p;
      if (hz < 180) l += p; else if (hz < 2000) m += p; else h += p;
      const log = Math.log1p(100 * Math.sqrt(p)); flux += Math.max(0, log - previous[k]); previous[k] = log;
    }
    const level = Math.sqrt(rms / (n * channels.length));
    rawEnergy.push(level); low.push(Math.sqrt(l)); mid.push(Math.sqrt(m)); high.push(Math.sqrt(h));
    novelty.push(level < .0003 ? 0 : flux); rawSpectrum.push(spectrum.map(v => Math.sqrt(v)));
    if (frame % 500 === 0) progress?.(frame / count);
  }
  const baseline = novelty.map((_, i) => mean(novelty.slice(Math.max(0, i - 10), Math.min(count, i + 11))));
  const flux = novelty.map((v, i) => Math.max(0, v - baseline[i])), scale = Math.max(1e-7, percentile(flux, .95));
  const scales = [rawEnergy, low, mid, high].map(v => Math.max(.0003, percentile(v, .95)));
  const normalized = [rawEnergy, low, mid, high].map((v, b) => v.map(x => clamp(x / scales[b])));
  const events: AudioFeatures["events"] = [];
  for (let i = 1; i < count - 1; i++) {
    if (flux[i] < scale * .28 || flux[i] <= 1e-7 || flux[i] < flux[i - 1] || flux[i] <= flux[i + 1] || rawEnergy[i] < .0003) continue;
    const time = round(i * hopSec); if (time > duration) continue;
    const event = { time, strength: round(clamp(flux[i] / scale)), low: round(normalized[1][i]), mid: round(normalized[2][i]), high: round(normalized[3][i]) };
    const previousEvent = events[events.length - 1];
    if (previousEvent && time - previousEvent.time < .1) { if (event.strength > previousEvent.strength) events[events.length - 1] = event; } else events.push(event);
  }
  const beats: number[] = [], qualities: number[] = [], bpms: number[] = [];
  for (let start = 0; start < duration; start += 8) {
    const slice = flux.slice(Math.floor(Math.max(0, start - 2) / hopSec), Math.ceil(Math.min(duration, start + 10) / hopSec));
    const pulse = estimatePulse(slice, hopSec); qualities.push(pulse.quality); bpms.push(pulse.bpm);
    let last = beats.at(-1) ?? -100;
    for (const event of events) {
      if (event.time < start || event.time >= start + 8 || event.strength < .3) continue;
      if (event.time - last >= pulse.period * .7) { beats.push(event.time); last = event.time; }
    }
  }
  const frames = Math.ceil(duration / .05);
  const curves = normalized.map(values => Array.from({ length: frames }, (_, i) => round(values[Math.min(count - 1, Math.round(i * .05 / hopSec))])));
  const spectrumScales = Array.from({ length: 16 }, (_, b) => Math.max(.0003, percentile(rawSpectrum.map(s => s[b]), .95)));
  const spectrumValues = Array.from({ length: frames }, (_, i) => rawSpectrum[Math.min(count - 1, Math.round(i * .05 / hopSec))].map((v, b) => Math.round(clamp(v / spectrumScales[b]) * 255))).flat();
  const features: AudioFeatures = { schemaVersion: 2, extractor: "spectral-flux-v2", hash, durationSec: duration, sampleRate, hopSec, fftSize: 1024, timeBase: "media-seconds-centered", beatQuality: round(mean(qualities)), events,
    curves: { stepSec: .05, energy: curves[0], low: curves[1], mid: curves[2], high: curves[3] }, spectrum: { bands: 16, stepSec: .05, values: spectrumValues } };
  const summarySize = Math.max(2, Math.min(160, frames));
  const energyCurve = Array.from({ length: summarySize }, (_, i) => curves[0][Math.min(frames - 1, Math.floor(i / (summarySize - 1) * (frames - 1)))]);
  progress?.(1);
  return { hash, durationSec: duration, bpm: round(percentile(bpms, .5) || 100), beats: beats.slice(0, 5000), onsets: events.slice(0, 5000).map(e => e.time), energyCurve, mood: ["balanced"],
    sections: { intro: [0, duration * .18], build: [duration * .18, duration * .45], peak: [duration * .45, duration * .82], outro: [duration * .82, duration] }, features };
}
