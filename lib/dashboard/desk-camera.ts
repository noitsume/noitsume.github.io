/** World units; the table surface is y=0. One path owns both arrival and replay. */
export function sampleDeskCamera(progress: number, aspect: number) {
  const p = Math.max(0, Math.min(1, progress));
  const spread = Math.max(.5, Math.min(1, aspect / 1.5));
  const turn = Math.min(1, p / .3);
  const travel = Math.max(0, (p - .3) / .7);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const a = smooth(turn), b = smooth(travel);
  // Interpolate distance separately from direction: lifting the viewpoint must
  // never make the final part of the approach drift backwards from the desk.
  const start = [-7.8 * spread, 4.95, 14.4];
  const end = [0, 10.3, 5.6];
  const direction = start.map((v, i) => v * (1 - b) + end[i] * b);
  const distance = Math.hypot(...start) * (1 - b) + Math.hypot(...end) * b;
  const scale = distance / Math.hypot(...direction);
  return {
    position: [direction[0] * scale, direction[1] * scale + .65 * (1 - b), direction[2] * scale + .4 - .2 * b] as const,
    target: [(-5.2 * (1 - a)) * spread, .65 * (1 - b), -.8 + 1.2 * a - .2 * b] as const,
    spread,
  };
}

export const DESK_CAMERA_DURATION = 2.35;
