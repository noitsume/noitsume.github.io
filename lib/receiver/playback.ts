/** Music gain follows actual audible playback, never just the focused section. */
export function musicGain(normal: number, ducked: number, relativeDb: number, foregroundVolume: number, mutedSection = false) {
  if (mutedSection) return 0;
  if (foregroundVolume <= 0) return normal;
  return Math.min(normal, ducked, foregroundVolume * Math.pow(10, relativeDb / 20));
}
/** Binary search keeps frame work logarithmic even for long beat maps. */
export function beatPulse(beats: number[], time: number) {
  let low = 0, high = beats.length;
  while (low < high) { const mid = (low + high) >>> 1; if (beats[mid] <= time) low = mid + 1; else high = mid; }
  if (!low) return 0;
  return Math.exp(-Math.max(0, time - beats[low - 1]) * 7);
}
export function energyAt(curve: number[], time: number, duration: number) {
  if (!curve.length || duration <= 0) return 0.4;
  const position = Math.min(curve.length - 1, Math.max(0, time / duration * (curve.length - 1)));
  const index = Math.floor(position);
  return curve[index] + ((curve[index + 1] ?? curve[index]) - curve[index]) * (position - index);
}
export function activeForegroundVolume(foreground: { id: string; volume: number } | null, sectionId?: string) {
  return foreground && sectionId && foreground.id === sectionId ? foreground.volume : 0;
}
