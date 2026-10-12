import { z } from "zod";

const unit = z.number().finite().min(0).max(1);
const curve = z.array(unit).min(1).max(24001);
export const audioFeaturesSchema = z.object({
  schemaVersion: z.literal(2), extractor: z.literal("spectral-flux-v2"),
  hash: z.string().regex(/^[a-f0-9]{64}$/), durationSec: z.number().finite().positive().max(1200),
  sampleRate: z.number().int().min(8000).max(96000), hopSec: z.number().positive().max(.05),
  fftSize: z.literal(1024), timeBase: z.literal("media-seconds-centered"), beatQuality: unit,
  events: z.array(z.object({ time: z.number().finite().nonnegative(), strength: unit, low: unit, mid: unit, high: unit })).max(12000),
  curves: z.object({ stepSec: z.literal(.05), energy: curve, low: curve, mid: curve, high: curve }),
  spectrum: z.object({ bands: z.literal(16), stepSec: z.literal(.05), values: z.array(z.number().int().min(0).max(255)).max(384016) }),
}).superRefine((v, ctx) => {
  const n = Math.ceil(v.durationSec / v.curves.stepSec);
  if ([v.curves.energy, v.curves.low, v.curves.mid, v.curves.high].some(c => c.length !== n) || v.spectrum.values.length !== n * 16) ctx.addIssue({ code: "custom", message: "Panjang kurva audio tidak sesuai durasi." });
  if (v.events.some((e, i) => e.time > v.durationSec || i > 0 && e.time <= v.events[i - 1].time)) ctx.addIssue({ code: "custom", message: "Serangan audio harus berurutan dan berada dalam durasi." });
});
export type AudioFeatures = z.infer<typeof audioFeaturesSchema>;
export type AudioEvent = AudioFeatures["events"][number];
export const audioBeatmapReferenceSchema = z.object({
  storageObjectKey: z.string().min(1), hash: z.string().regex(/^[a-f0-9]{64}$/), durationSec: z.number().positive(), version: z.literal("music-v2"),
});
export type AudioBeatmapReference = z.infer<typeof audioBeatmapReferenceSchema>;
export type AudioTimeline = { beats: number[]; onsets: number[]; energy: number[]; duration: number; features?: AudioFeatures; accentTimes?: number[] };
/** Sparse strong attacks only; maintain the same spacing when a track loops. */
export function selectAccentTimes(events: readonly AudioEvent[], duration: number): number[] {
  const selected: number[] = [];
  for (const event of events) if (event.strength >= .7 && event.time - (selected.at(-1) ?? -100) >= .55) selected.push(event.time);
  if (selected.length > 1 && duration - selected.at(-1)! + selected[0] < .55) selected.pop();
  return duration >= .55 ? selected : [];
}
export type AuraFrame = { time: number; energy: number; low: number; mid: number; high: number; impact: number; accent: number; eventTime: number; eventStrength: number; seed: number; spectrum: number[]; echoes: Array<[number, number, number]>; active: boolean };
export const emptyAuraFrame = (): AuraFrame => ({ time: 0, energy: 0, low: 0, mid: 0, high: 0, impact: 0, accent: 0, eventTime: -100, eventStrength: 0, seed: 0, spectrum: Array(16).fill(0), echoes: [], active: false });
export function lastIndexAt(times: readonly number[], time: number) {
  let lo = 0, hi = times.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (times[mid] <= time) lo = mid + 1; else hi = mid; }
  return lo - 1;
}
function interpolate(values: readonly number[], position: number) {
  const i = Math.max(0, Math.min(values.length - 1, Math.floor(position)));
  return (values[i] ?? 0) + ((values[Math.min(i + 1, values.length - 1)] ?? 0) - (values[i] ?? 0)) * Math.max(0, Math.min(1, position - i));
}
/** Stateless sampling: seek/loop never queues missed impacts; pulse peaks at its event. */
export function sampleAudioTimeline(map: AudioTimeline, time: number): AuraFrame {
  time = Number.isFinite(time) ? Math.max(0, Math.min(time, map.duration)) : 0;
  const f = map.features, position = time / (f?.curves.stepSec ?? (map.duration / Math.max(1, map.energy.length - 1)));
  const energy = interpolate(f?.curves.energy ?? map.energy, position);
  let index = -1, event: AudioEvent | undefined;
  if (f) {
    let lo = 0, hi = f.events.length;
    while (lo < hi) { const m = (lo + hi) >>> 1; if (f.events[m].time <= time) lo = m + 1; else hi = m; }
    index = lo - 1; event = f.events[index];
  } else {
    const times = map.onsets.length ? map.onsets : map.beats;
    index = lastIndexAt(times, time);
    if (index >= 0) event = { time: times[index], strength: .55, low: energy, mid: energy, high: energy * .3 };
  }
  const age = event ? Math.max(0, time - event.time) : 100;
  const accents = map.accentTimes ?? [], accentIndex = lastIndexAt(accents, time);
  const accent = accentIndex >= 0 ? Math.exp(-(time - accents[accentIndex]) / .09) : 0;
  const echoes: AuraFrame["echoes"] = [];
  for (let i = index; i >= Math.max(0, index - 5); i--) {
    const previous = f?.events[i];
    const when = previous?.time ?? (map.onsets.length ? map.onsets[i] : map.beats[i]);
    if (time - when < 3) echoes.push([when, previous?.strength ?? .55, i]);
  }
  const spectrum = Array.from({ length: 16 }, (_, band) => {
    if (!f) return energy * (1 - band / 22);
    const frame = Math.max(0, Math.min(Math.floor(position), f.curves.energy.length - 1)), next = Math.min(frame + 1, f.curves.energy.length - 1);
    const a = f.spectrum.values[frame * 16 + band] / 255, b = f.spectrum.values[next * 16 + band] / 255;
    return a + (b - a) * Math.min(1, Math.max(0, position - frame));
  });
  return { time, energy, low: f ? interpolate(f.curves.low, position) : energy, mid: f ? interpolate(f.curves.mid, position) : energy, high: f ? interpolate(f.curves.high, position) : energy * .3,
    impact: (event?.strength ?? 0) * Math.exp(-age / .13), accent, eventTime: event?.time ?? -100, eventStrength: event?.strength ?? 0, seed: Math.max(0, index), spectrum, echoes, active: true };
}
